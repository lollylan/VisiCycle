from sqlalchemy.orm import Session
import models, schemas
from geopy.geocoders import Nominatim
from datetime import datetime, timedelta
from services.encryption import encryption_service

# Initialize geocoder with a unique user agent to respect OSM policy
geolocator = Nominatim(user_agent="medical_visit_planner_offline_v1")


# ─── Patient CRUD ─────────────────────────────────────────

def get_patient(db: Session, patient_id: int):
    return db.query(models.Patient).filter(models.Patient.id == patient_id).first()


def get_patients(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Patient).offset(skip).limit(limit).all()


def create_patient(db: Session, patient: schemas.PatientCreate):
    # Use provided coords or geocode
    lat, lon = patient.latitude, patient.longitude
    geocoding_warning = None

    if not lat or not lon:
        try:
            location = geolocator.geocode(patient.address + ", Würzburg, Germany")
            if location:
                lat = location.latitude
                lon = location.longitude
            else:
                geocoding_warning = (
                    f"Adresse konnte nicht gefunden werden: \"{patient.address}\". "
                    "Patient wurde ohne Koordinaten gespeichert und erscheint nicht auf der Karte."
                )
        except Exception as e:
            print(f"Geocoding failed for {patient.address}: {e}")
            geocoding_warning = (
                f"Geocoding-Fehler für \"{patient.address}\": {e}. "
                "Patient wurde ohne Koordinaten gespeichert."
            )

    # Encrypt sensitive fields
    enc = encryption_service
    encrypted_vorname = enc.encrypt(patient.vorname) if enc.is_unlocked else patient.vorname
    encrypted_nachname = enc.encrypt(patient.nachname) if enc.is_unlocked else patient.nachname
    encrypted_address = enc.encrypt(patient.address) if enc.is_unlocked else patient.address

    # Determine last_visit and planned_visit_date from first_visit_date
    if patient.first_visit_date:
        first_visit_dt = datetime.combine(patient.first_visit_date, datetime.min.time())
        if patient.is_einmalig:
            # One-time patients: set planned_visit_date so they appear on that day's plan
            last_visit_val = datetime.utcnow()
            planned_visit_val = first_visit_dt
        else:
            # Regular patients: backdate last_visit so next due = first_visit_date
            days = patient.interval_days if patient.interval_days > 0 else 0
            last_visit_val = first_visit_dt - timedelta(days=days)
            planned_visit_val = None
    else:
        last_visit_val = datetime.utcnow()
        planned_visit_val = None

    db_patient = models.Patient(
        vorname=encrypted_vorname,
        nachname=encrypted_nachname,
        address=encrypted_address,
        interval_days=patient.interval_days,
        visit_duration_minutes=patient.visit_duration_minutes,
        latitude=lat,
        longitude=lon,
        last_visit=last_visit_val,
        planned_visit_date=planned_visit_val,
        is_einmalig=patient.is_einmalig,
        primary_behandler_id=patient.primary_behandler_id,
    )
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    # Attach warning as transient attribute (not persisted in DB)
    db_patient.geocoding_warning = geocoding_warning
    return db_patient


def decrypt_patient(patient: models.Patient) -> models.Patient:
    """Decrypt sensitive fields for API response (in-place, does not commit)."""
    if encryption_service.is_unlocked:
        patient.vorname = encryption_service.decrypt(patient.vorname)
        patient.nachname = encryption_service.decrypt(patient.nachname)
        patient.address = encryption_service.decrypt(patient.address)
    return patient


# ─── Behandler CRUD ───────────────────────────────────────

def get_behandler(db: Session, behandler_id: int):
    return db.query(models.Behandler).filter(models.Behandler.id == behandler_id).first()


def get_all_behandler(db: Session):
    return db.query(models.Behandler).all()


def create_behandler(db: Session, behandler: schemas.BehandlerCreate):
    db_behandler = models.Behandler(
        name=behandler.name,
        rolle=behandler.rolle,
        farbe=behandler.farbe,
        max_daily_minutes=behandler.max_daily_minutes,
    )
    db.add(db_behandler)
    db.commit()
    db.refresh(db_behandler)
    return db_behandler


def update_behandler(db: Session, behandler_id: int, data: schemas.BehandlerUpdate):
    db_behandler = get_behandler(db, behandler_id)
    if not db_behandler:
        return None
    if data.name is not None:
        db_behandler.name = data.name
    if data.rolle is not None:
        db_behandler.rolle = data.rolle
    if data.farbe is not None:
        db_behandler.farbe = data.farbe
    if data.max_daily_minutes is not None:
        db_behandler.max_daily_minutes = data.max_daily_minutes
    db.commit()
    db.refresh(db_behandler)
    return db_behandler


def delete_behandler(db: Session, behandler_id: int):
    db_behandler = get_behandler(db, behandler_id)
    if not db_behandler:
        return False

    # Clear all patient references to this Behandler before deleting
    patients_primary = db.query(models.Patient).filter(
        models.Patient.primary_behandler_id == behandler_id
    ).all()
    for p in patients_primary:
        p.primary_behandler_id = None

    patients_override = db.query(models.Patient).filter(
        models.Patient.override_behandler_id == behandler_id
    ).all()
    for p in patients_override:
        p.override_behandler_id = None

    db.delete(db_behandler)
    db.commit()
    return True
