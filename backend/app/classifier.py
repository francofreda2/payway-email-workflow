import json
import httpx
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)

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
    
    if not s.gemini_api_key:
        logger.warning("Gemini API key not configured, returning default classification")
        return {"category": "sin_categorizar", "urgency": "media", "summary": "API key no configurada"}
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{s.gemini_model}:generateContent?key={s.gemini_api_key}"
    
    payload = {
        "contents": [{"parts": [{"text": PROMPT.format(subject=subject, sender=sender, body=body_preview or subject)}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 200},
    }
    
    try:
        logger.info(f"Classifying email: {subject[:50]}...")
        resp = httpx.post(url, json=payload, timeout=30)
        
        if resp.status_code != 200:
            logger.error(f"Gemini API error {resp.status_code}: {resp.text[:200]}")
            return {"category": "sin_categorizar", "urgency": "media", "summary": f"Error API {resp.status_code}"}
        
        response_data = resp.json()
        
        if "candidates" not in response_data or not response_data["candidates"]:
            logger.error(f"Invalid Gemini response structure: {response_data}")
            return {"category": "sin_categorizar", "urgency": "media", "summary": "Respuesta inválida de IA"}
        
        text = response_data["candidates"][0]["content"]["parts"][0]["text"]
        text = text.strip().removeprefix("```json").removesuffix("```").strip()
        
        result = json.loads(text)
        logger.info(f"Classification successful: {result}")
        return result
        
    except httpx.TimeoutException:
        logger.error("Gemini API timeout")
        return {"category": "sin_categorizar", "urgency": "media", "summary": "Timeout de IA"}
    except httpx.RequestError as e:
        logger.error(f"Gemini API request error: {e}")
        return {"category": "sin_categorizar", "urgency": "media", "summary": "Error de conexión"}
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON from Gemini: {text[:100]}... Error: {e}")
        return {"category": "sin_categorizar", "urgency": "media", "summary": "JSON inválido de IA"}
    except KeyError as e:
        logger.error(f"Missing key in Gemini response: {e}")
        return {"category": "sin_categorizar", "urgency": "media", "summary": "Estructura de respuesta inválida"}
    except Exception as e:
        logger.error(f"Unexpected error in classification: {type(e).__name__}: {e}")
        return {"category": "sin_categorizar", "urgency": "media", "summary": "Error inesperado"}
