from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class PatientBase(BaseModel):
    name: str
    address: str
    interval_days: int
    visit_duration_minutes: int = 30

class PatientCreate(PatientBase):
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class Patient(PatientBase):
    id: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    last_visit: datetime
    planned_visit_date: Optional[datetime] = None

    class Config:
        from_attributes = True

class PatientUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    interval_days: Optional[int] = None
    visit_duration_minutes: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class SettingsBase(BaseModel):
    key: str
    value: str

class SettingsCreate(SettingsBase):
    pass

class Settings(SettingsBase):
    class Config:
        from_attributes = True

class LocationUpdate(BaseModel):
    address: str
    city: str

