import json
import httpx
from app.config import get_settings

PROMPT = """Sos un asistente de clasificación de correos para Payway, procesadora de medios de pago.

Clasificá el siguiente correo en:
1. **category**: una de [consulta_comercial, soporte_tecnico, reclamo, facturacion, integracion_api, fraude_seguridad, operaciones, regulatorio, interno, otro]
2. **urgency**: una de [critica, alta, media, baja] basándote en el contenido y contexto de medios de pago

Respondé SOLO con JSON válido, sin texto adicional:
{{"category": "...", "urgency": "..."}}

Asunto: {subject}
De: {sender}
Preview: {body}"""


def categorize_email(subject: str, sender: str, body_preview: str) -> dict:
    s = get_settings()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{s.gemini_model}:generateContent?key={s.gemini_api_key}"

    try:
        resp = httpx.post(url, json={
            "contents": [{"parts": [{"text": PROMPT.format(subject=subject, sender=sender, body=body_preview)}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 100},
        }, timeout=30)
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        # Limpiar markdown si viene envuelto en ```json
        text = text.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(text)
    except Exception:
        return {"category": "sin_categorizar", "urgency": "media"}
