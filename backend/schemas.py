from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional


# ─── Behandler (Practitioner) ─────────────────────────────
class BehandlerBase(BaseModel):
    name: str
    rolle: str  # "Arzt", "VERAH", "PCM", etc.
    farbe: str = "#33656E"
    max_daily_minutes: int = 240


class BehandlerCreate(BehandlerBase):
    pass


class Behandler(BehandlerBase):
    id: int

    class Config:
        from_attributes = True


class BehandlerUpdate(BaseModel):
    name: Optional[str] = None
    rolle: Optional[str] = None
    farbe: Optional[str] = None
    max_daily_minutes: Optional[int] = None


# ─── Patient ──────────────────────────────────────────────
class PatientBase(BaseModel):
    vorname: str
    nachname: str
    address: str
    interval_days: int = 0
    visit_duration_minutes: int = 30
    primary_behandler_id: Optional[int] = None
    is_einmalig: bool = False


class PatientCreate(PatientBase):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    first_visit_date: Optional[date] = None  # If set, schedules first visit on this date


class Patient(PatientBase):
    id: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    last_visit: datetime
    planned_visit_date: Optional[datetime] = None
    override_behandler_id: Optional[int] = None
    primary_behandler: Optional[Behandler] = None
    override_behandler: Optional[Behandler] = None
    is_einmalig: bool = False
    geocoding_warning: Optional[str] = None
    distance_from_praxis_km: Optional[float] = None

    class Config:
        from_attributes = True


class PatientUpdate(BaseModel):
    vorname: Optional[str] = None
    nachname: Optional[str] = None
    address: Optional[str] = None
    interval_days: Optional[int] = None
    visit_duration_minutes: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    primary_behandler_id: Optional[int] = None
    override_behandler_id: Optional[int] = None
    is_einmalig: Optional[bool] = None
    planned_visit_date: Optional[date] = None  # Explicit next visit date (overrides interval)


# ─── Settings ─────────────────────────────────────────────
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


# ─── Auth ─────────────────────────────────────────────────
class SetupPassword(BaseModel):
    password: str
    password_confirm: str


class LoginRequest(BaseModel):
    password: str


# ─── Override Behandler ───────────────────────────────────
class OverrideBehandler(BaseModel):
    behandler_id: Optional[int] = None  # None = clear override
    permanent: bool = False  # If true, change primary instead of override
