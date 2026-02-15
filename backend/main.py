from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta

import models, schemas, crud
from database import SessionLocal, engine
from services import routing

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Medical Visit Planner", description="Offline-First Hausbesuchsplaner")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], 
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

# PRAXIS LOCATION (Hardcoded for demo, could be in settings)
# Würzburg Marktplatz approximation
PRAXIS_COORDS = (49.79245, 9.93296) 

@app.post("/patients/", response_model=schemas.Patient)
def create_patient(patient: schemas.PatientCreate, db: Session = Depends(get_db)):
    return crud.create_patient(db=db, patient=patient)

@app.get("/patients/", response_model=List[schemas.Patient])
def read_patients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_patients(db, skip=skip, limit=limit)

@app.put("/patients/{patient_id}/visit", response_model=schemas.Patient)
def register_visit(patient_id: int, db: Session = Depends(get_db)):
    db_patient = crud.get_patient(db, patient_id=patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    db_patient.last_visit = datetime.utcnow()
    db_patient.planned_visit_date = None # Clear manual schedule
    db.commit()
    db.refresh(db_patient)
    return db_patient

@app.get("/planner/today")
def get_todays_plan(db: Session = Depends(get_db)):
    """
    Returns patients due today or overdue, optimized by route.
    """
    all_patients = crud.get_patients(db, limit=1000)
    due_patients = []
    
    now = datetime.utcnow()
    
    for p in all_patients:
        # Check if snoozed
        if p.snooze_until and p.snooze_until > now:
             continue

        # Check if due based on interval
        next_visit_date = p.last_visit + timedelta(days=p.interval_days)
        is_due_by_interval = next_visit_date.date() <= (now + timedelta(days=1)).date()
        
        # Check if manually planned
        is_manually_planned = False
        if p.planned_visit_date:
            is_manually_planned = p.planned_visit_date.date() <= (now + timedelta(days=1)).date()

        if is_due_by_interval or is_manually_planned: 
             due_patients.append(p)
             
    # Get Praxis Coords from Settings
    praxis_lat = db.query(models.Settings).filter(models.Settings.key == "praxis_lat").first()
    praxis_lon = db.query(models.Settings).filter(models.Settings.key == "praxis_lon").first()
    
    current_praxis_coords = PRAXIS_COORDS
    if praxis_lat and praxis_lon:
        try:
             current_praxis_coords = (float(praxis_lat.value), float(praxis_lon.value))
        except:
             pass

    # Optimize Route
    optimized_route = routing.optimize_route(current_praxis_coords, due_patients)
    
    # Calculate Total Travel Time
    total_travel_time = 0
    current_pos = current_praxis_coords
    
    for p in optimized_route:
        if p.latitude and p.longitude:
            dist = routing.haversine_distance(current_pos[0], current_pos[1], p.latitude, p.longitude)
            total_travel_time += routing.calculate_travel_time_minutes(dist)
            current_pos = (p.latitude, p.longitude)
            
    # Return Trip to Praxis
    if current_pos != current_praxis_coords and current_pos is not None:
         dist = routing.haversine_distance(current_pos[0], current_pos[1], current_praxis_coords[0], current_praxis_coords[1])
         total_travel_time += routing.calculate_travel_time_minutes(dist)

    return {
        "patients": optimized_route,
        "stats": {
            "total_travel_time_minutes": total_travel_time,
            "patient_count": len(optimized_route)
        }
    }

@app.put("/patients/{patient_id}", response_model=schemas.Patient)
def update_patient(patient_id: int, patient_update: schemas.PatientUpdate, db: Session = Depends(get_db)):
    db_patient = crud.get_patient(db, patient_id=patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Update fields if provided
    if patient_update.name:
        db_patient.name = patient_update.name
    
    # Handle Address Change
    if patient_update.address and patient_update.address != db_patient.address:
        db_patient.address = patient_update.address
        # Re-geocode if no manual coords provided
        if not patient_update.latitude and not patient_update.longitude:
            try:
                # We use the geolocator from crud module
                location = crud.geolocator.geocode(patient_update.address + ", Würzburg, Germany")
                if location:
                    db_patient.latitude = location.latitude
                    db_patient.longitude = location.longitude
                else:
                    # Reset coords if not found? Or keep old? Let's reset to avoid misleading location
                    db_patient.latitude = None
                    db_patient.longitude = None
            except Exception as e:
                print(f"Geocoding failed for {patient_update.address}: {e}")

    if patient_update.interval_days:
        db_patient.interval_days = patient_update.interval_days
    if patient_update.visit_duration_minutes:
        db_patient.visit_duration_minutes = patient_update.visit_duration_minutes
    
    # Manual Coords Override
    if patient_update.latitude:
        db_patient.latitude = patient_update.latitude
    if patient_update.longitude:
        db_patient.longitude = patient_update.longitude
        
    db.commit()
    db.refresh(db_patient)
    return db_patient

@app.delete("/patients/{patient_id}")
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    db_patient = crud.get_patient(db, patient_id=patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    db.delete(db_patient)
    db.commit()
    return {"message": "Patient deleted"}

@app.post("/patients/{patient_id}/schedule", response_model=schemas.Patient)
def schedule_patient(patient_id: int, db: Session = Depends(get_db)):
    """
    Manually schedule a patient for TODAY.
    """
    db_patient = crud.get_patient(db, patient_id=patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
            
    db_patient.planned_visit_date = datetime.utcnow()
    # Also clear snooze if any
    db_patient.snooze_until = None
    
    db.commit()
    db.refresh(db_patient)
    return db_patient

@app.post("/patients/{patient_id}/unschedule", response_model=schemas.Patient)
def unschedule_patient(patient_id: int, db: Session = Depends(get_db)):
    """
    Remove patient from today's manual schedule AND snooze them until tomorrow if they were due.
    """
    db_patient = crud.get_patient(db, patient_id=patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
            
    db_patient.planned_visit_date = None
    
    # Snooze until tomorrow 
    tomorrow = datetime.utcnow() + timedelta(days=1)
    # Set to beginning of tomorrow? Or just tomorrow same time? 
    # Let's set to beginning of tomorrow to be safe
    tomorrow_start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
    db_patient.snooze_until = tomorrow_start
    
    db.commit()
    db.refresh(db_patient)
    return db_patient

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
    full_address = f"{loc.address}, {loc.city}, Germany"
    
    # Geocode
    lat, lon = PRAXIS_COORDS # Fallback
    try:
        location = crud.geolocator.geocode(full_address)
        if location:
            lat = location.latitude
            lon = location.longitude
    except Exception as e:
        print(f"Geocoding failed: {e}")
    
    # Save Settings
    create_or_update_setting(schemas.SettingsCreate(key="praxis_address", value=loc.address), db)
    create_or_update_setting(schemas.SettingsCreate(key="praxis_city", value=loc.city), db)
    create_or_update_setting(schemas.SettingsCreate(key="praxis_lat", value=str(lat)), db)
    create_or_update_setting(schemas.SettingsCreate(key="praxis_lon", value=str(lon)), db)
    
    return {"message": "Location updated", "lat": lat, "lon": lon}
