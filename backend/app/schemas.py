from pydantic import BaseModel
from datetime import datetime


class EmailOut(BaseModel):
    id: str
    subject: str
    sender: str
    received_at: datetime
    body_preview: str | None
    summary: str | None
    category: str
    urgency: str
    status: str
    assigned_to: str | None
    notes: str | None
    has_reply: bool
    importance: str
    synced_at: datetime
    age_hours: int = 0

    class Config:
        from_attributes = True


class EmailUpdate(BaseModel):
    status: str | None = None
    assigned_to: str | None = None
    notes: str | None = None
    category: str | None = None
    urgency: str | None = None


class StatsOut(BaseModel):
    total: int
    pendiente: int
    en_proceso: int
    respondido: int
    cerrado: int
    by_category: dict[str, int]
    by_urgency: dict[str, int]
    avg_age_hours: float
