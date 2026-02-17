from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    vorname = Column(String, index=True)  # Encrypted
    nachname = Column(String, index=True)  # Encrypted
    address = Column(String)  # Encrypted
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    interval_days = Column(Integer)  # How often to visit (in days)
    last_visit = Column(DateTime, default=datetime.datetime.utcnow)
    visit_duration_minutes = Column(Integer, default=30)
    planned_visit_date = Column(DateTime, nullable=True)  # Manual override for specific date
    snooze_until = Column(DateTime, nullable=True)  # Hide from plan until this date
    is_einmalig = Column(Boolean, default=False)  # One-time visit patient (auto-deleted after visit)

    # Behandler (Practitioner) assignment
    primary_behandler_id = Column(Integer, ForeignKey("behandler.id"), nullable=True)
    primary_behandler = relationship("Behandler", foreign_keys=[primary_behandler_id])

    # One-time override: if set, this Behandler does the NEXT visit only
    override_behandler_id = Column(Integer, ForeignKey("behandler.id"), nullable=True)
    override_behandler = relationship("Behandler", foreign_keys=[override_behandler_id])


class Behandler(Base):
    """A practitioner / care provider (Arzt, VERAH, PCM, etc.)"""
    __tablename__ = "behandler"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    rolle = Column(String)  # e.g. "Arzt", "VERAH", "PCM"
    farbe = Column(String, default="#33656E")  # Color for map route display
    max_daily_minutes = Column(Integer, default=240)  # Daily availability in minutes


class Settings(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(String)
