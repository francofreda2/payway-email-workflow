import json
import re
import httpx
import logging
from html.parser import HTMLParser
from app.config import get_settings

logger = logging.getLogger(__name__)


# --- Limpieza de HTML ---
class _HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self._parts: list[str] = []
        self._skip = False

    def handle_starttag(self, tag, attrs):
        self._skip = tag in ("style", "script", "head")
        if tag in ("br", "p", "div", "tr", "li"):
            self._parts.append("\n")

    def handle_endtag(self, tag):
        self._skip = False

    def handle_data(self, data):
        if not self._skip:
            self._parts.append(data)

    def get_text(self) -> str:
        return "".join(self._parts)


def strip_html(html: str) -> str:
    if not html:
        return ""
    stripper = _HTMLStripper()
    stripper.feed(html)
    text = stripper.get_text()
    # Colapsar whitespace excesivo
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


# --- Prompt con definiciones + few-shot ---
PROMPT = """Sos un asistente experto de Payway (Prisma Medios de Pago), procesadora de pagos en Argentina.

Tu tarea es clasificar correos del buzón del equipo.

## CATEGORÍAS (elegí exactamente una):
- consulta_comercial: Preguntas sobre productos, planes, tarifas, condiciones comerciales, alta de comercios, habilitaciones
- soporte_tecnico: Problemas técnicos con terminales POS, plataforma web, errores de sistema, conectividad
- reclamo: Quejas formales, disconformidad con el servicio, pedidos de compensación, escalamientos
- facturacion: Consultas sobre liquidaciones, retenciones, impuestos, diferencias de montos, estados de cuenta
- integracion_api: Dudas o problemas con APIs de pago, SDKs, webhooks, certificados, documentación técnica
- fraude_seguridad: Reportes de transacciones sospechosas, contracargos por fraude, phishing, vulnerabilidades
- operaciones: Temas operativos del día a día: lotes, cierres, anulaciones, devoluciones, reprocesos
- regulatorio: Temas de compliance, normativas BCRA, PCI-DSS, auditorías, documentación legal
- interno: Comunicaciones internas de Prisma/Payway entre empleados, reuniones, coordinación interna
- otro: Correos que no encajan en ninguna categoría anterior

## URGENCIA:
- critica: Fraude activo, caída de servicio, pérdida de dinero en curso, bloqueo total de operaciones
- alta: Deadline cercano, cliente enojado, problema que afecta ventas, escalamiento
- media: Consultas normales que requieren respuesta pero sin urgencia inmediata
- baja: Informativos, newsletters, confirmaciones, FYIs, agradecimientos

## EJEMPLOS:

Asunto: Problema con liquidación de marzo - diferencia de $150.000
De: comercio@tienda.com.ar
Contenido: Hola, revisando la liquidación de marzo notamos una diferencia de $150.000 respecto a lo que esperábamos. Necesitamos que revisen los números.
→ {{"category": "facturacion", "urgency": "alta", "summary": "Pide revisión de liquidación de marzo por diferencia de $150.000"}}

Asunto: RE: Reunión equipo soporte - jueves 15hs
De: juan.perez@prismamediosdepago.com
Contenido: Dale, confirmo asistencia. Llevo el informe de tickets del mes.
→ {{"category": "interno", "urgency": "baja", "summary": "Confirma asistencia a reunión interna del equipo"}}

Asunto: URGENTE - Terminal no procesa pagos desde ayer
De: gerencia@restaurant.com.ar
Contenido: Buenas, desde ayer a la tarde la terminal POS no procesa ningún pago. Probamos reiniciar y sigue igual. Estamos perdiendo ventas, necesitamos solución urgente.
→ {{"category": "soporte_tecnico", "urgency": "critica", "summary": "Terminal POS sin procesar pagos desde ayer, perdiendo ventas"}}

Asunto: Consulta integración API de pagos
De: dev@fintech.com
Contenido: Hola equipo, estamos integrando la API de pagos y tenemos dudas sobre el endpoint de tokenización. ¿Pueden compartir documentación actualizada?
→ {{"category": "integracion_api", "urgency": "media", "summary": "Solicita documentación del endpoint de tokenización de la API"}}

Asunto: Transacciones sospechosas en comercio 4521
De: riesgo@banco.com.ar
Contenido: Detectamos un patrón inusual de transacciones en el comercio 4521. Múltiples pagos de montos similares en intervalos cortos. Solicitamos revisión inmediata y posible bloqueo preventivo.
→ {{"category": "fraude_seguridad", "urgency": "critica", "summary": "Patrón sospechoso de transacciones en comercio 4521, piden bloqueo preventivo"}}

Asunto: Solicitud de alta nuevo comercio
De: ventas@distribuidora.com.ar
Contenido: Buen día, quisiéramos dar de alta nuestro comercio en la plataforma Payway. Somos una distribuidora con 3 sucursales. ¿Cuáles son los requisitos y tarifas?
→ {{"category": "consulta_comercial", "urgency": "media", "summary": "Solicita alta de comercio nuevo con 3 sucursales, pide requisitos y tarifas"}}

## REGLAS ADICIONALES:
- Si el sender contiene @prismamediosdepago.com o @payway.com → probablemente "interno"
- Si el asunto tiene "RE:" o "FW:" analizá el contenido real, no solo el asunto
- Si el body está vacío o es muy corto, basate en el asunto y sender

## CORREO A CLASIFICAR:

Asunto: {subject}
De: {sender}
Contenido: {body}

Respondé SOLO con JSON válido, sin texto adicional ni markdown:
{{"category": "...", "urgency": "...", "summary": "..."}}"""


MAX_BODY_CHARS = 3000


def categorize_email(subject: str, sender: str, body_preview: str) -> dict:
    s = get_settings()

    if not s.gemini_api_key:
        logger.warning("Gemini API key not configured")
        return {"category": "sin_categorizar", "urgency": "media", "summary": "API key no configurada"}

    # Limpiar HTML y truncar para no exceder contexto
    clean_body = strip_html(body_preview)
    if len(clean_body) > MAX_BODY_CHARS:
        clean_body = clean_body[:MAX_BODY_CHARS] + "..."

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{s.gemini_model}:generateContent?key={s.gemini_api_key}"

    payload = {
        "contents": [{"parts": [{"text": PROMPT.format(subject=subject, sender=sender, body=clean_body or subject)}]}],
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
            logger.error(f"Invalid Gemini response: {response_data}")
            return {"category": "sin_categorizar", "urgency": "media", "summary": "Respuesta inválida de IA"}

        text = response_data["candidates"][0]["content"]["parts"][0]["text"]
        text = text.strip().removeprefix("```json").removesuffix("```").strip()

        result = json.loads(text)

        # Validar que las claves existan y los valores sean válidos
        valid_categories = {"consulta_comercial", "soporte_tecnico", "reclamo", "facturacion",
                           "integracion_api", "fraude_seguridad", "operaciones", "regulatorio",
                           "interno", "otro"}
        valid_urgencies = {"critica", "alta", "media", "baja"}

        if result.get("category") not in valid_categories:
            logger.warning(f"Invalid category '{result.get('category')}', defaulting to sin_categorizar")
            result["category"] = "sin_categorizar"
        if result.get("urgency") not in valid_urgencies:
            logger.warning(f"Invalid urgency '{result.get('urgency')}', defaulting to media")
            result["urgency"] = "media"

        logger.info(f"Classification: {result}")
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
    except Exception as e:
        logger.error(f"Unexpected error: {type(e).__name__}: {e}")
        return {"category": "sin_categorizar", "urgency": "media", "summary": "Error inesperado"}
