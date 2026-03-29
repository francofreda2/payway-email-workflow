from sqlalchemy import create_engine, Column, String, DateTime, Text, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime, timezone
from app.config import get_settings

Base = declarative_base()


class Email(Base):
    __tablename__ = "emails"

    id = Column(String, primary_key=True)
    subject = Column(String, nullable=False)
    sender = Column(String, nullable=False)
    received_at = Column(DateTime, nullable=False)
    body_preview = Column(Text)
    summary = Column(Text, nullable=True)
    category = Column(String, default="sin_categorizar")
    urgency = Column(String, default="media")
    status = Column(String, default="pendiente")
    assigned_to = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    has_reply = Column(Boolean, default=False)
    importance = Column(String, default="normal")
    synced_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


db_url = get_settings().database_url
connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
engine = create_engine(db_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
