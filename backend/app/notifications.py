from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models import Email, SessionLocal
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)


def check_pending_alerts():
    s = get_settings()
    db: Session = SessionLocal()
    try:
        threshold = datetime.now(timezone.utc) - timedelta(hours=s.alert_hours_threshold)
        pending = (
            db.query(Email)
            .filter(Email.status == "pendiente", Email.received_at < threshold)
            .order_by(Email.received_at.asc())
            .all()
        )
        if not pending:
            return

        logger.warning(f"⚠️ {len(pending)} correos pendientes superan las {s.alert_hours_threshold}h:")
        for e in pending:
            age = datetime.now(timezone.utc) - e.received_at.replace(tzinfo=timezone.utc)
            hours = int(age.total_seconds() / 3600)
            logger.warning(f"  [{hours}h] {e.subject} - de: {e.sender} - cat: {e.category}")

        # Acá se puede extender para enviar por mail o Slack
    finally:
        db.close()
