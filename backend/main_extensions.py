@app.put("/patients/{patient_id}", response_model=schemas.Patient)
def update_patient(patient_id: int, patient_update: schemas.PatientUpdate, db: Session = Depends(get_db)):
    db_patient = crud.get_patient(db, patient_id=patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Update fields if provided
    if patient_update.name:
        db_patient.name = patient_update.name
    if patient_update.address:
        # If address changes, we might want to re-geocode? 
        # For offline simplicity, let's keep old coords unless explicitly handled, 
        # OR attempt re-geocode if we had an online checker. 
        # For now, just update the string.
        db_patient.address = patient_update.address
    if patient_update.interval_days:
        db_patient.interval_days = patient_update.interval_days
    if patient_update.visit_duration_minutes:
        db_patient.visit_duration_minutes = patient_update.visit_duration_minutes
        
    db.commit()
    db.refresh(db_patient)
    return db_patient

@app.post("/patients/{patient_id}/schedule", response_model=schemas.Patient)
def schedule_patient(patient_id: int, date: datetime = None, db: Session = Depends(get_db)):
    """
    Manually schedule a patient for a specific date (default: today).
    """
    db_patient = crud.get_patient(db, patient_id=patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    if date is None:
        date = datetime.utcnow()
        
    db_patient.planned_visit_date = date
    db.commit()
    db.refresh(db_patient)
    return db_patient
