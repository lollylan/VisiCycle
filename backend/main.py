from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
import hashlib
import secrets
import shutil
import os
from fastapi import UploadFile, File
from fastapi.responses import FileResponse

import models, schemas, crud
from database import SessionLocal, engine
from services import routing
from services.encryption import encryption_service

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="VisiCycle - Hausbesuchsplaner", description="Offline-First Hausbesuchsplaner mit Verschlüsselung")

# CORS – allow all origins in LAN (network access)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# PRAXIS LOCATION (Fallback)
PRAXIS_COORDS = (49.79245, 9.93296)


def _patient_to_dict(p, distance_km=None):
    """Serialize a decrypted ORM patient to a plain dict for JSON responses."""
    return {
        "id": p.id,
        "vorname": p.vorname,
        "nachname": p.nachname,
        "address": p.address,
        "latitude": p.latitude,
        "longitude": p.longitude,
        "interval_days": p.interval_days,
        "visit_duration_minutes": p.visit_duration_minutes,
        "last_visit": p.last_visit.isoformat() if p.last_visit else None,
        "planned_visit_date": p.planned_visit_date.isoformat() if p.planned_visit_date else None,
        "is_einmalig": p.is_einmalig,
        "primary_behandler_id": p.primary_behandler_id,
        "override_behandler_id": p.override_behandler_id,
        "snooze_until": p.snooze_until.isoformat() if p.snooze_until else None,
        "distance_from_praxis_km": distance_km,
    }


def require_unlocked():
    """Dependency: require the encryption service to be unlocked (user logged in)."""
    if not encryption_service.is_unlocked:
        raise HTTPException(status_code=401, detail="Nicht eingeloggt. Bitte zuerst das Passwort eingeben.")


# ─── AUTH ENDPOINTS ───────────────────────────────────────

@app.get("/auth/status")
def auth_status(db: Session = Depends(get_db)):
    """Check if a master password has been set and if the session is unlocked."""
    pw_hash = db.query(models.Settings).filter(models.Settings.key == "master_password_hash").first()
    return {
        "is_setup": pw_hash is not None,
        "is_unlocked": encryption_service.is_unlocked,
    }


@app.post("/auth/setup")
def auth_setup(data: schemas.SetupPassword, db: Session = Depends(get_db)):
    """Set the master password for the first time."""
    # Check if already set up
    existing = db.query(models.Settings).filter(models.Settings.key == "master_password_hash").first()
    if existing:
        raise HTTPException(status_code=400, detail="Passwort wurde bereits eingerichtet.")

    if data.password != data.password_confirm:
        raise HTTPException(status_code=400, detail="Passwörter stimmen nicht überein.")

    if len(data.password) < 4:
        raise HTTPException(status_code=400, detail="Passwort muss mindestens 4 Zeichen lang sein.")

    # Hash the password and store it (PBKDF2-HMAC-SHA256)
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", data.password.encode(), salt.encode(), 100_000).hex()
    stored_value = f"{salt}${hashed}"
    db_setting = models.Settings(key="master_password_hash", value=stored_value)
    db.add(db_setting)
    db.commit()

    # Unlock the encryption service
    encryption_service.unlock(data.password)

    # Encrypt any existing patient data that was stored unencrypted
    _encrypt_existing_patients(db)

    return {"message": "Passwort eingerichtet und Datenbank verschlüsselt."}


@app.post("/auth/login")
def auth_login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Login with the master password to unlock the encrypted database."""
    pw_record = db.query(models.Settings).filter(models.Settings.key == "master_password_hash").first()
    if not pw_record:
        raise HTTPException(status_code=400, detail="Noch kein Passwort eingerichtet. Bitte zuerst einrichten.")

    # Verify password
    try:
        salt, stored_hash = pw_record.value.split("$", 1)
        check_hash = hashlib.pbkdf2_hmac("sha256", data.password.encode(), salt.encode(), 100_000).hex()
        if check_hash != stored_hash:
            raise HTTPException(status_code=401, detail="Falsches Passwort.")
    except ValueError:
        raise HTTPException(status_code=401, detail="Falsches Passwort.")

    # Unlock encryption
    encryption_service.unlock(data.password)

    return {"message": "Erfolgreich eingeloggt."}


@app.post("/auth/logout")
def auth_logout():
    """Lock the encryption service."""
    encryption_service.lock()
    return {"message": "Abgemeldet."}


def _encrypt_existing_patients(db: Session):
    """One-time migration: encrypt all existing patient data after initial password setup."""
    all_patients = db.query(models.Patient).all()
    for p in all_patients:
        # Only encrypt if not already encrypted (simple heuristic: Fernet tokens start with 'gAAAAA')
        if p.vorname and not p.vorname.startswith("gAAAAA"):
            p.vorname = encryption_service.encrypt(p.vorname)
        if p.nachname and not p.nachname.startswith("gAAAAA"):
            p.nachname = encryption_service.encrypt(p.nachname)
        if p.address and not p.address.startswith("gAAAAA"):
            p.address = encryption_service.encrypt(p.address)
    db.commit()


# ─── PATIENT ENDPOINTS ───────────────────────────────────

@app.post("/patients/")
def create_patient(patient: schemas.PatientCreate, db: Session = Depends(get_db), _=Depends(require_unlocked)):
    db_patient = crud.create_patient(db=db, patient=patient)
    geocoding_warning = getattr(db_patient, 'geocoding_warning', None)

    # Auto-schedule one-time patients for today
    if db_patient.is_einmalig:
        db_patient.planned_visit_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        db.commit()
        db.refresh(db_patient)

    crud.decrypt_patient(db_patient)
    result = _patient_to_dict(db_patient)
    result["geocoding_warning"] = geocoding_warning
    return result


@app.get("/patients/", response_model=List[schemas.Patient])
def read_patients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _=Depends(require_unlocked)):
    patients = crud.get_patients(db, skip=skip, limit=limit)
    for p in patients:
        crud.decrypt_patient(p)
    return patients


@app.put("/patients/{patient_id}/visit")
def register_visit(patient_id: int, db: Session = Depends(get_db), _=Depends(require_unlocked)):
    db_patient = crud.get_patient(db, patient_id=patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # If this is a one-time patient, delete them after the visit
    if db_patient.is_einmalig:
        db.delete(db_patient)
        db.commit()
        return {"message": "Einmaliger Patient erledigt und entfernt.", "deleted": True}

    db_patient.last_visit = datetime.utcnow()
    db_patient.planned_visit_date = None

    # Clear the one-time override after the visit is done
    db_patient.override_behandler_id = None

    db.commit()
    db.refresh(db_patient)
    crud.decrypt_patient(db_patient)
    return db_patient


@app.put("/patients/{patient_id}")
def update_patient(patient_id: int, patient_update: schemas.PatientUpdate, db: Session = Depends(get_db), _=Depends(require_unlocked)):
    db_patient = crud.get_patient(db, patient_id=patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Decrypt current values for comparison
    current_address = encryption_service.decrypt(db_patient.address) if encryption_service.is_unlocked else db_patient.address

    if patient_update.vorname:
        db_patient.vorname = encryption_service.encrypt(patient_update.vorname) if encryption_service.is_unlocked else patient_update.vorname
    if patient_update.nachname:
        db_patient.nachname = encryption_service.encrypt(patient_update.nachname) if encryption_service.is_unlocked else patient_update.nachname

    # Handle Address Change
    geocoding_warning = None
    if patient_update.address and patient_update.address != current_address:
        db_patient.address = encryption_service.encrypt(patient_update.address) if encryption_service.is_unlocked else patient_update.address
        # Re-geocode if no manual coords provided
        if not patient_update.latitude and not patient_update.longitude:
            try:
                location = crud.geolocator.geocode(patient_update.address + ", Würzburg, Germany")
                if location:
                    db_patient.latitude = location.latitude
                    db_patient.longitude = location.longitude
                else:
                    db_patient.latitude = None
                    db_patient.longitude = None
                    geocoding_warning = (
                        f"Neue Adresse konnte nicht gefunden werden: \"{patient_update.address}\". "
                        "Koordinaten wurden zurückgesetzt."
                    )
            except Exception as e:
                print(f"Geocoding failed for {patient_update.address}: {e}")
                geocoding_warning = (
                    f"Geocoding-Fehler für \"{patient_update.address}\": {e}."
                )

    if patient_update.interval_days:
        db_patient.interval_days = patient_update.interval_days
    if patient_update.visit_duration_minutes:
        db_patient.visit_duration_minutes = patient_update.visit_duration_minutes

    # Manual Coords Override
    if patient_update.latitude:
        db_patient.latitude = patient_update.latitude
    if patient_update.longitude:
        db_patient.longitude = patient_update.longitude

    # Behandler assignment
    if patient_update.primary_behandler_id is not None:
        db_patient.primary_behandler_id = patient_update.primary_behandler_id if patient_update.primary_behandler_id != 0 else None
    if patient_update.override_behandler_id is not None:
        db_patient.override_behandler_id = patient_update.override_behandler_id if patient_update.override_behandler_id != 0 else None

    # Planned visit date: update only if explicitly included in the request
    if 'planned_visit_date' in patient_update.model_fields_set:
        if patient_update.planned_visit_date is None:
            db_patient.planned_visit_date = None  # Clear the date
        else:
            db_patient.planned_visit_date = datetime.combine(patient_update.planned_visit_date, datetime.min.time())

    db.commit()
    db.refresh(db_patient)
    crud.decrypt_patient(db_patient)
    result = _patient_to_dict(db_patient)
    result["geocoding_warning"] = geocoding_warning
    return result


@app.delete("/patients/{patient_id}")
def delete_patient(patient_id: int, db: Session = Depends(get_db), _=Depends(require_unlocked)):
    db_patient = crud.get_patient(db, patient_id=patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    db.delete(db_patient)
    db.commit()
    return {"message": "Patient deleted"}


@app.post("/patients/{patient_id}/schedule", response_model=schemas.Patient)
def schedule_patient(patient_id: int, db: Session = Depends(get_db), _=Depends(require_unlocked)):
    """Manually schedule a patient for TODAY."""
    db_patient = crud.get_patient(db, patient_id=patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    db_patient.planned_visit_date = datetime.utcnow()
    db_patient.snooze_until = None

    db.commit()
    db.refresh(db_patient)
    crud.decrypt_patient(db_patient)
    return db_patient


@app.post("/patients/{patient_id}/unschedule", response_model=schemas.Patient)
def unschedule_patient(patient_id: int, db: Session = Depends(get_db), _=Depends(require_unlocked)):
    """Remove patient from today's plan and snooze until tomorrow."""
    db_patient = crud.get_patient(db, patient_id=patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    db_patient.planned_visit_date = None

    tomorrow = datetime.utcnow() + timedelta(days=1)
    tomorrow_start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
    db_patient.snooze_until = tomorrow_start

    db.commit()
    db.refresh(db_patient)
    crud.decrypt_patient(db_patient)
    return db_patient


@app.post("/patients/{patient_id}/override-behandler", response_model=schemas.Patient)
def override_behandler(patient_id: int, data: schemas.OverrideBehandler, db: Session = Depends(get_db), _=Depends(require_unlocked)):
    """
    Change the Behandler for a patient.
    - permanent=False: one-time override (cleared after next visit)
    - permanent=True: change the primary Behandler
    """
    db_patient = crud.get_patient(db, patient_id=patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if data.permanent:
        db_patient.primary_behandler_id = data.behandler_id
        db_patient.override_behandler_id = None  # Clear any one-time override
    else:
        db_patient.override_behandler_id = data.behandler_id

    db.commit()
    db.refresh(db_patient)
    crud.decrypt_patient(db_patient)
    return db_patient


# ─── PLANNER ENDPOINT ─────────────────────────────────────

@app.get("/planner/today")
def get_todays_plan(db: Session = Depends(get_db), _=Depends(require_unlocked)):
    """
    Returns patients due today, grouped by Behandler, with optimized routes per Behandler.
    """
    all_patients = crud.get_patients(db, limit=1000)
    due_patients = []

    now = datetime.utcnow()

    for p in all_patients:
        if p.snooze_until and p.snooze_until > now:
            continue

        # One-time patients: only show if explicitly scheduled (planned_visit_date set)
        if p.is_einmalig:
            if p.planned_visit_date and p.planned_visit_date.date() <= (now + timedelta(days=1)).date():
                due_patients.append(p)
            continue

        # Regular patients: skip if interval is 0 (no recurring schedule)
        if p.interval_days and p.interval_days > 0:
            next_visit_date = p.last_visit + timedelta(days=p.interval_days)
            is_due_by_interval = next_visit_date.date() <= (now + timedelta(days=1)).date()
        else:
            is_due_by_interval = False

        is_manually_planned = False
        if p.planned_visit_date:
            is_manually_planned = p.planned_visit_date.date() <= (now + timedelta(days=1)).date()

        if is_due_by_interval or is_manually_planned:
            due_patients.append(p)

    # Get Praxis Coords
    praxis_lat = db.query(models.Settings).filter(models.Settings.key == "praxis_lat").first()
    praxis_lon = db.query(models.Settings).filter(models.Settings.key == "praxis_lon").first()

    current_praxis_coords = PRAXIS_COORDS
    if praxis_lat and praxis_lon:
        try:
            current_praxis_coords = (float(praxis_lat.value), float(praxis_lon.value))
        except:
            pass

    # Read radius settings
    radius_fuss_setting = db.query(models.Settings).filter(models.Settings.key == "radius_fuss").first()
    radius_rad_setting = db.query(models.Settings).filter(models.Settings.key == "radius_rad").first()
    radius_fuss_km = float(radius_fuss_setting.value) if radius_fuss_setting else 1.0
    radius_rad_km = float(radius_rad_setting.value) if radius_rad_setting else 3.0

    # Get all Behandler
    all_behandler = crud.get_all_behandler(db)
    behandler_map = {b.id: b for b in all_behandler}

    # Group patients by their effective Behandler (override > primary)
    grouped = {}  # behandler_id -> [patients]
    unassigned = []  # patients without a Behandler

    for p in due_patients:
        effective_id = p.override_behandler_id or p.primary_behandler_id
        if effective_id and effective_id in behandler_map:
            if effective_id not in grouped:
                grouped[effective_id] = []
            grouped[effective_id].append(p)
        else:
            unassigned.append(p)

    # Build routes per Behandler
    routes_by_behandler = []

    for b_id, b_patients in grouped.items():
        b = behandler_map[b_id]
        optimized = routing.optimize_route(current_praxis_coords, b_patients)

        # Calculate travel time
        total_travel_time = 0
        current_pos = current_praxis_coords
        for p in optimized:
            if p.latitude and p.longitude:
                dist = routing.haversine_distance(current_pos[0], current_pos[1], p.latitude, p.longitude)
                total_travel_time += routing.calculate_travel_time_minutes(dist)
                current_pos = (p.latitude, p.longitude)

        if current_pos != current_praxis_coords:
            dist = routing.haversine_distance(current_pos[0], current_pos[1], current_praxis_coords[0], current_praxis_coords[1])
            total_travel_time += routing.calculate_travel_time_minutes(dist)

        # Decrypt and convert patients to serializable dicts with distance
        patient_dicts = []
        for p in optimized:
            crud.decrypt_patient(p)
            dist = round(
                routing.haversine_distance(
                    current_praxis_coords[0], current_praxis_coords[1],
                    p.latitude, p.longitude
                ), 2
            ) if p.latitude and p.longitude else None
            patient_dicts.append(_patient_to_dict(p, distance_km=dist))

        routes_by_behandler.append({
            "behandler": {
                "id": b.id,
                "name": b.name,
                "rolle": b.rolle,
                "farbe": b.farbe,
            },
            "patients": patient_dicts,
            "stats": {
                "total_travel_time_minutes": total_travel_time,
                "patient_count": len(patient_dicts),
            }
        })

    # Also handle unassigned patients (combined route)
    if unassigned:
        optimized = routing.optimize_route(current_praxis_coords, unassigned)
        total_travel_time = 0
        current_pos = current_praxis_coords
        for p in optimized:
            if p.latitude and p.longitude:
                dist = routing.haversine_distance(current_pos[0], current_pos[1], p.latitude, p.longitude)
                total_travel_time += routing.calculate_travel_time_minutes(dist)
                current_pos = (p.latitude, p.longitude)

        if current_pos != current_praxis_coords:
            dist = routing.haversine_distance(current_pos[0], current_pos[1], current_praxis_coords[0], current_praxis_coords[1])
            total_travel_time += routing.calculate_travel_time_minutes(dist)

        patient_dicts = []
        for p in optimized:
            crud.decrypt_patient(p)
            dist = round(
                routing.haversine_distance(
                    current_praxis_coords[0], current_praxis_coords[1],
                    p.latitude, p.longitude
                ), 2
            ) if p.latitude and p.longitude else None
            patient_dicts.append(_patient_to_dict(p, distance_km=dist))

        routes_by_behandler.append({
            "behandler": {
                "id": None,
                "name": "Nicht zugewiesen",
                "rolle": "",
                "farbe": "#94a3b8",
            },
            "patients": patient_dicts,
            "stats": {
                "total_travel_time_minutes": total_travel_time,
                "patient_count": len(patient_dicts),
            }
        })

    # Also provide a flat list for backwards compatibility
    all_due_decrypted = []
    for route in routes_by_behandler:
        all_due_decrypted.extend(route["patients"])

    total_all_travel = sum(r["stats"]["total_travel_time_minutes"] for r in routes_by_behandler)

    return {
        "patients": all_due_decrypted,
        "routes_by_behandler": routes_by_behandler,
        "stats": {
            "total_travel_time_minutes": total_all_travel,
            "patient_count": len(all_due_decrypted),
        },
        "radius_settings": {
            "fuss_km": radius_fuss_km,
            "rad_km": radius_rad_km,
        }
    }


# ─── BEHANDLER ENDPOINTS ─────────────────────────────────

@app.get("/behandler/", response_model=List[schemas.Behandler])
def list_behandler(db: Session = Depends(get_db), _=Depends(require_unlocked)):
    return crud.get_all_behandler(db)


@app.post("/behandler/", response_model=schemas.Behandler)
def create_behandler(data: schemas.BehandlerCreate, db: Session = Depends(get_db), _=Depends(require_unlocked)):
    return crud.create_behandler(db, data)


@app.put("/behandler/{behandler_id}", response_model=schemas.Behandler)
def update_behandler(behandler_id: int, data: schemas.BehandlerUpdate, db: Session = Depends(get_db), _=Depends(require_unlocked)):
    result = crud.update_behandler(db, behandler_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Behandler not found")
    return result


@app.delete("/behandler/{behandler_id}")
def delete_behandler(behandler_id: int, db: Session = Depends(get_db), _=Depends(require_unlocked)):
    success = crud.delete_behandler(db, behandler_id)
    if not success:
        raise HTTPException(status_code=404, detail="Behandler not found")
    return {"message": "Behandler gelöscht"}


# ─── SETTINGS ENDPOINTS ──────────────────────────────────

@app.get("/settings/{key}", response_model=schemas.Settings)
def get_setting(key: str, db: Session = Depends(get_db)):
    setting = db.query(models.Settings).filter(models.Settings.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting


@app.post("/settings/", response_model=schemas.Settings)
def create_or_update_setting(setting: schemas.SettingsCreate, db: Session = Depends(get_db)):
    db_setting = db.query(models.Settings).filter(models.Settings.key == setting.key).first()
    if db_setting:
        db_setting.value = setting.value
    else:
        db_setting = models.Settings(key=setting.key, value=setting.value)
        db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting


@app.post("/settings/location")
def update_location(loc: schemas.LocationUpdate, db: Session = Depends(get_db)):
    from geopy.geocoders import Nominatim
    geolocator = Nominatim(user_agent="medical_visit_planner_offline_v1")

    def _save_setting(key, value):
        s = db.query(models.Settings).filter(models.Settings.key == key).first()
        if s:
            s.value = value
        else:
            db.add(models.Settings(key=key, value=value))

    _save_setting("praxis_address", f"{loc.address} {loc.city}")

    coords = None
    geocoding_error = None
    try:
        full_address = f"{loc.address}, {loc.city}, Germany"
        location = geolocator.geocode(full_address)
        if location:
            coords = (location.latitude, location.longitude)
            _save_setting("praxis_lat", str(location.latitude))
            _save_setting("praxis_lon", str(location.longitude))
        else:
            geocoding_error = (
                f"Adresse \"{loc.address}, {loc.city}\" konnte nicht gefunden werden. "
                "Bitte prüfen Sie die Schreibweise."
            )
    except Exception as e:
        print(f"Geocoding failed: {e}")
        geocoding_error = f"Geocoding-Fehler: {e}"

    # Always commit address text, even if geocoding failed
    db.commit()

    if geocoding_error:
        raise HTTPException(status_code=400, detail=geocoding_error)

    return {"message": "Standort gespeichert", "coords": coords}


# ─── BACKUP & RESTORE ────────────────────────────────────

@app.get("/backup/export")
def export_database(_=Depends(require_unlocked)):
    """Downloads the current SQLITE database file."""
    db_path = "db.sqlite3"
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Datenbankdatei nicht gefunden.")
    
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    filename = f"visicycle_backup_{timestamp}.sqlite3"
    
    return FileResponse(path=db_path, filename=filename, media_type='application/octet-stream')


@app.post("/backup/import")
async def import_database(file: UploadFile = File(...), _=Depends(require_unlocked)):
    """Restores the database from an uploaded file. WARNING: Overwrites current data!"""
    db_path = "db.sqlite3"
    
    # 1. Close all connections to release file lock on Windows
    engine.dispose()
    
    # 2. Save uploaded file to temp path
    try:
        temp_path = "db.sqlite3.new"
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 3. Rename/Overwrite
        # On Windows, we might need to remove the old file first if dispose() didn't fully release it instantaneously,
        # but usually dispose() is enough. If fails, we catch it.
        if os.path.exists(db_path):
            os.remove(db_path)
            
        os.rename(temp_path, db_path)
        
        # 4. Re-init engine (optional, but good practice)
        # engine is global so it will reconnect on next request
        
        return {"message": "Backup erfolgreich wiederhergestellt. Bitte starten Sie die Anwendung neu!"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Wiederherstellen: {str(e)}")
