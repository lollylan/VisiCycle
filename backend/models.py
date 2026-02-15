from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base
import datetime

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    address = Column(String)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    interval_days = Column(Integer)  # How often to visit (in days)
    last_visit = Column(DateTime, default=datetime.datetime.utcnow)
    visit_duration_minutes = Column(Integer, default=30)
    planned_visit_date = Column(DateTime, nullable=True) # Manual override for specific date
    snooze_until = Column(DateTime, nullable=True) # Hide from plan until this date

class Settings(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(String)
