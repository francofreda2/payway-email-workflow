import json
import httpx
from app.config import get_settings

PROMPT = """Sos un asistente experto de Payway, procesadora de medios de pago en Argentina.

Analizá el siguiente correo y devolvé:
1. **category**: una de [consulta_comercial, soporte_tecnico, reclamo, facturacion, integracion_api, fraude_seguridad, operaciones, regulatorio, interno, otro]
2. **urgency**: una de [critica, alta, media, baja]. Usá "critica" si mencionan fraude, caída de servicio o pérdida de dinero. "alta" si es urgente o tiene deadline. "media" para consultas normales. "baja" para informativos.
3. **summary**: Escribí en español un resumen claro y concreto de QUÉ NECESITA o PIDE el remitente. Máximo 100 caracteres. No repitas el asunto. Enfocate en la acción requerida. Ejemplos buenos: "Pide corrección de liquidación de marzo por diferencia de montos", "Solicita alta de nuevo comercio en plataforma", "Reporta error en API de pagos al procesar transacciones".

IMPORTANTE: El summary debe explicar qué hay que hacer, no solo describir el mail.

Respondé SOLO con JSON válido, sin texto adicional ni markdown:
{{"category": "...", "urgency": "...", "summary": "..."}}

Asunto: {subject}
De: {sender}
Contenido: {body}"""


def categorize_email(subject: str, sender: str, body_preview: str) -> dict:
    s = get_settings()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{s.gemini_model}:generateContent?key={s.gemini_api_key}"

    try:
        resp = httpx.post(url, json={
            "contents": [{"parts": [{"text": PROMPT.format(subject=subject, sender=sender, body=body_preview or subject)}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 200},
        }, timeout=30)
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        text = text.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(text)
    except Exception:
        return {"category": "sin_categorizar", "urgency": "media", "summary": "No se pudo analizar el correo"}
