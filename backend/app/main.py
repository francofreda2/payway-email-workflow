import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

import httpx
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

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


@app.get("/api/ai-status")
def get_ai_status():
    """Diagnóstico del estado de la IA"""
    s = get_settings()
    
    status = {
        "gemini_configured": bool(s.gemini_api_key),
        "gemini_model": s.gemini_model,
        "api_key_length": len(s.gemini_api_key) if s.gemini_api_key else 0
    }
    
    # Test de conectividad si está configurado
    if s.gemini_api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{s.gemini_model}:generateContent?key={s.gemini_api_key}"
            resp = httpx.post(url, json={
                "contents": [{"parts": [{"text": "Test"}]}],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 10},
            }, timeout=10)
            status["api_test"] = "success" if resp.status_code == 200 else f"error_{resp.status_code}"
            status["api_response"] = resp.text[:200] if resp.status_code != 200 else "OK"
        except Exception as e:
            status["api_test"] = "connection_error"
            status["api_response"] = str(e)[:200]
    else:
        status["api_test"] = "not_configured"
        status["api_response"] = "Gemini API key not set in .env file"
    
    return status


@app.post("/api/ai-test")
def test_ai_classification():
    """Prueba la clasificación de IA con un correo de ejemplo"""
    test_email = {
        "subject": "Problema con transacción rechazada - Urgente",
        "sender": "comercio@ejemplo.com",
        "body": "Hola, tengo un problema urgente. Mi transacción por $50.000 fue rechazada sin motivo aparente. Necesito que me ayuden a resolverlo cuanto antes porque tengo clientes esperando."
    }
    
    try:
        from app.classifier import categorize_email
        result = categorize_email(
            subject=test_email["subject"],
            sender=test_email["sender"], 
            body_preview=test_email["body"]
        )
        return {
            "status": "success",
            "test_email": test_email,
            "classification": result
        }
    except Exception as e:
        return {
            "status": "error",
            "test_email": test_email,
            "error": str(e),
            "error_type": type(e).__name__
        }


@app.get("/api/debug/recent-emails")
def get_recent_emails_debug(db: Session = Depends(get_db)):
    """Debug: Ver últimos correos y su estado de clasificación"""
    emails = db.query(Email).order_by(Email.received_at.desc()).limit(10).all()
    
    result = []
    for email in emails:
        result.append({
            "id": email.id,
            "subject": email.subject,
            "sender": email.sender,
            "received_at": email.received_at.isoformat(),
            "category": email.category,
            "urgency": email.urgency,
            "summary": email.summary,
            "body_preview": email.body_preview[:100] if email.body_preview else None,
            "synced_at": email.synced_at.isoformat() if email.synced_at else None,
            "updated_at": email.updated_at.isoformat() if email.updated_at else None
        })
    
    return {
        "total_emails": len(result),
        "emails": result,
        "classification_stats": {
            "classified": len([e for e in emails if e.summary and e.summary != ""]),
            "unclassified": len([e for e in emails if not e.summary or e.summary == ""]),
            "sin_categorizar": len([e for e in emails if e.category == "sin_categorizar"])
        }
    }


# Lista de filtros para excluir correos
EXCLUDE_SUBJECTS = [
    "newsletter", "boletín", "información", "noticias", "marketing", 
    "promoción", "oferta", "descuento", "suscripción", "unsubscribe",
    "no-reply", "noreply", "automated", "automático", "system"
]

EXCLUDE_SENDERS = [
    "noreply", "no-reply", "marketing", "newsletter", "automated",
    "system", "donotreply", "info@", "news@", "promo@"
]

def should_exclude_email(subject: str, sender: str) -> bool:
    """Determina si un correo debe ser excluido del backlog"""
    subject_lower = subject.lower()
    sender_lower = sender.lower()
    
    # Verificar asunto
    for exclude_term in EXCLUDE_SUBJECTS:
        if exclude_term in subject_lower:
            return True
    
    # Verificar remitente
    for exclude_term in EXCLUDE_SENDERS:
        if exclude_term in sender_lower:
            return True
    
    return False


def classify_in_background(email_id: str, subject: str, sender: str, body: str):
    import logging
    logger = logging.getLogger(__name__)
    db = SessionLocal()
    try:
        logger.info(f"Starting background classification for email {email_id}")
        classification = categorize_email(subject=subject, sender=sender, body_preview=body)
        email = db.query(Email).filter_by(id=email_id).first()
        if email:
            email.category = classification.get("category", "sin_categorizar")
            email.urgency = classification.get("urgency", "media")
            email.summary = classification.get("summary", "")
            db.commit()
            logger.info(f"Email {email_id} classified successfully")
        else:
            logger.warning(f"Email {email_id} not found for classification")
    except Exception as e:
        logger.error(f"Error in background classification for {email_id}: {e}")
        db.rollback()
    finally:
        db.close()


# --- Webhook: Power Automate manda correos acá ---
@app.post("/api/emails/ingest")
def receive_email(data: IncomingEmail, background: BackgroundTasks, db: Session = Depends(get_db)):
    logger.info(f"Received email: {data.subject} from {data.sender}")
    
    # Verificar si el correo debe ser excluido
    if should_exclude_email(data.subject, data.sender):
        logger.info(f"Email excluded by filters: {data.subject}")
        return {"status": "excluded", "reason": "Email filtered out", "subject": data.subject}
    
    if db.query(Email).filter_by(id=data.message_id).first():
        logger.info(f"Duplicate email ignored: {data.message_id}")
        return {"status": "duplicate", "id": data.message_id}

    if data.received_at:
        try:
            received = datetime.fromisoformat(data.received_at.replace("Z", "+00:00"))
        except Exception as e:
            logger.warning(f"Invalid received_at format: {data.received_at}, using current time. Error: {e}")
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
    
    try:
        db.add(email)
        db.commit()
        logger.info(f"Email saved to database: {data.message_id}")
        
        background.add_task(classify_in_background, data.message_id, data.subject, data.sender, data.body)
        logger.info(f"Classification task queued for: {data.message_id}")
        
        return {"status": "created", "id": email.id}
    except Exception as e:
        logger.error(f"Error saving email to database: {e}")
        db.rollback()
        return {"status": "error", "message": str(e)}


@app.post("/api/emails/reclassify")
def reclassify_emails(background: BackgroundTasks, db: Session = Depends(get_db)):
    """Re-clasifica todos los correos sin resumen o con categoría 'sin_categorizar'"""
    emails = db.query(Email).filter(
        (Email.summary == None) | 
        (Email.summary == "") | 
        (Email.category == "sin_categorizar")
    ).all()
    
    count = 0
    for email in emails:
        background.add_task(
            classify_in_background, 
            email.id, 
            email.subject, 
            email.sender, 
            email.body_preview
        )
        count += 1
    
    return {"status": "queued", "count": count, "message": f"Re-clasificando {count} correos en segundo plano"}


@app.get("/api/filters")
def get_filters():
    """Obtiene la lista actual de filtros"""
    return {
        "exclude_subjects": EXCLUDE_SUBJECTS,
        "exclude_senders": EXCLUDE_SENDERS
    }


from pydantic import BaseModel as PydanticBaseModel

class FilterRequest(PydanticBaseModel):
    exclude_subjects: list[str]
    exclude_senders: list[str]

@app.post("/api/filters")
def update_filters(req: FilterRequest):
    """Actualiza los filtros de exclusión (solo en memoria)"""
    global EXCLUDE_SUBJECTS, EXCLUDE_SENDERS
    EXCLUDE_SUBJECTS = [term.lower().strip() for term in req.exclude_subjects if term.strip()]
    EXCLUDE_SENDERS = [term.lower().strip() for term in req.exclude_senders if term.strip()]
    return {"status": "updated", "exclude_subjects": EXCLUDE_SUBJECTS, "exclude_senders": EXCLUDE_SENDERS}


# --- Emails CRUD ---
@app.get("/api/emails", response_model=list[EmailOut])
def list_emails(
    status: str | None = None,
    category: str | None = None,
    urgency: str | None = None,
    search: str | None = None,
    include_closed: bool = False,  # Por defecto no incluir cerrados
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Email)
    
    # Excluir cerrados por defecto, a menos que se solicite explícitamente
    if not include_closed and status != "cerrado":
        q = q.filter(Email.status != "cerrado")
    
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


# --- Chat IA: preguntas sobre los correos ---
from pydantic import BaseModel as PydanticBaseModel

class ChatRequest(PydanticBaseModel):
    question: str

@app.post("/api/chat")
def chat_with_ai(req: ChatRequest, db: Session = Depends(get_db)):
    emails = db.query(Email).order_by(Email.received_at.desc()).limit(50).all()
    context = "\n".join([f"- [{e.status}] De: {e.sender} | Asunto: {e.subject} | Categoría: {e.category} | Urgencia: {e.urgency} | Resumen: {e.summary or 'N/A'} | Asignado: {e.assigned_to or 'Sin asignar'} | Antigüedad: {e.id}" for e in emails])

    s = get_settings()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{s.gemini_model}:generateContent?key={s.gemini_api_key}"
    prompt = f"""Sos un asistente de gestión de correos de Payway (procesadora de medios de pago). Tenés acceso al backlog de correos actual. Respondé en español, de forma concisa y útil.

Backlog actual ({len(emails)} correos):
{context}

Pregunta del usuario: {req.question}"""

    try:
        resp = httpx.post(url, json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 500},
        }, timeout=30)
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        return {"answer": text}
    except Exception as ex:
        return {"answer": f"Error al consultar IA: {str(ex)}"}


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


# --- Serve frontend SPA (catch-all, must be last) ---
@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    file = STATIC_DIR / full_path
    if file.exists() and file.is_file():
        return FileResponse(file)
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"detail": "Frontend not built yet. Run: cd frontend && npm run build"}
