from sqlalchemy.orm import Session
import models, schemas
from geopy.geocoders import Nominatim
from datetime import datetime

# Initialize geocoder with a unique user agent to respect OSM policy
geolocator = Nominatim(user_agent="medical_visit_planner_offline_v1")

def get_patient(db: Session, patient_id: int):
    return db.query(models.Patient).filter(models.Patient.id == patient_id).first()

def get_patients(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Patient).offset(skip).limit(limit).all()

def create_patient(db: Session, patient: schemas.PatientCreate):
    # Use provided coords or geocode
    lat, lon = patient.latitude, patient.longitude
    
    if not lat or not lon:
        try:
            location = geolocator.geocode(patient.address + ", Würzburg, Germany")
            if location:
                lat = location.latitude
                lon = location.longitude
        except Exception as e:
            print(f"Geocoding failed for {patient.address}: {e}")

    db_patient = models.Patient(
        name=patient.name,
        address=patient.address,
        interval_days=patient.interval_days,
        visit_duration_minutes=patient.visit_duration_minutes,
        latitude=lat,
        longitude=lon,
        last_visit=datetime.utcnow()
    )
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient
