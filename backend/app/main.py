from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.models import Email, SessionLocal, get_db
from app.schemas import EmailOut, EmailUpdate, StatsOut
from app.outlook import IncomingEmail
from app.classifier import categorize_email
from app.notifications import check_pending_alerts

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(check_pending_alerts, "interval", minutes=30, id="alerts")
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="Payway Email Workflow", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def classify_in_background(email_id: str, subject: str, sender: str, body: str):
    db = SessionLocal()
    try:
        classification = categorize_email(subject=subject, sender=sender, body_preview=body)
        email = db.query(Email).filter_by(id=email_id).first()
        if email:
            email.category = classification.get("category", "sin_categorizar")
            email.urgency = classification.get("urgency", "media")
            db.commit()
    finally:
        db.close()


# --- Webhook: Power Automate manda correos acá ---
@app.post("/api/emails/ingest")
def receive_email(data: IncomingEmail, background: BackgroundTasks, db: Session = Depends(get_db)):
    if db.query(Email).filter_by(id=data.message_id).first():
        return {"status": "duplicate", "id": data.message_id}

    if data.received_at:
        try:
            received = datetime.fromisoformat(data.received_at.replace("Z", "+00:00"))
        except Exception:
            received = datetime.now(timezone.utc)
    else:
        received = datetime.now(timezone.utc)
    email = Email(
        id=data.message_id,
        subject=data.subject,
        sender=data.sender,
        received_at=received,
        body_preview=data.body[:500] if data.body else "",
        category="sin_categorizar",
        urgency="media",
        has_reply=False,
        importance=data.importance,
    )
    db.add(email)
    db.commit()

    background.add_task(classify_in_background, data.message_id, data.subject, data.sender, data.body)
    return {"status": "created", "id": email.id}


# --- Emails CRUD ---
@app.get("/api/emails", response_model=list[EmailOut])
def list_emails(
    status: str | None = None,
    category: str | None = None,
    urgency: str | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Email)
    if status:
        q = q.filter(Email.status == status)
    if category:
        q = q.filter(Email.category == category)
    if urgency:
        q = q.filter(Email.urgency == urgency)
    if search:
        q = q.filter(Email.subject.ilike(f"%{search}%") | Email.sender.ilike(f"%{search}%"))

    emails = q.order_by(Email.received_at.desc()).offset(skip).limit(limit).all()
    now = datetime.now(timezone.utc)
    result = []
    for e in emails:
        out = EmailOut.model_validate(e)
        received = e.received_at.replace(tzinfo=timezone.utc) if e.received_at.tzinfo is None else e.received_at
        out.age_hours = int((now - received).total_seconds() / 3600)
        result.append(out)
    return result


@app.patch("/api/emails/{email_id}", response_model=EmailOut)
def update_email(email_id: str, data: EmailUpdate, db: Session = Depends(get_db)):
    email = db.query(Email).filter_by(id=email_id).first()
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(email, field, value)
    db.commit()
    db.refresh(email)
    return email


@app.get("/api/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(Email.id)).scalar()
    by_status = dict(db.query(Email.status, func.count(Email.id)).group_by(Email.status).all())
    by_cat = dict(db.query(Email.category, func.count(Email.id)).group_by(Email.category).all())
    by_urg = dict(db.query(Email.urgency, func.count(Email.id)).group_by(Email.urgency).all())

    pending = db.query(Email).filter(Email.status == "pendiente").all()
    now = datetime.now(timezone.utc)
    ages = [(now - e.received_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600 for e in pending]

    return StatsOut(
        total=total or 0,
        pendiente=by_status.get("pendiente", 0),
        en_proceso=by_status.get("en_proceso", 0),
        respondido=by_status.get("respondido", 0),
        cerrado=by_status.get("cerrado", 0),
        by_category=by_cat,
        by_urgency=by_urg,
        avg_age_hours=round(sum(ages) / len(ages), 1) if ages else 0,
    )
