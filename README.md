# Payway Email Workflow

Sistema de gestión de correos del equipo con categorización por IA, backlog y notificaciones.

## Costo: ~$0.05/mes

- Power Automate → incluido en licencia M365
- Gemini Flash → ~$0.05 por cada 1000 correos
- SQLite → embebido, gratis
- Docker → gratis

## Arquitectura

```
Outlook (correo nuevo)
    │
    ▼
Power Automate (trigger automático)
    │  HTTP POST /api/incoming
    ▼
Backend FastAPI
    ├── Clasifica con Gemini Flash (API)
    ├── Guarda en SQLite (backlog)
    └── Alerta correos pendientes antiguos
    │
    ▼
Frontend React (dashboard)
```

## Setup

### 1. Obtener API Key de Gemini
Ir a https://aistudio.google.com/apikey → Create API Key → copiar

### 2. Instalar Docker Desktop
Descargar de https://www.docker.com/products/docker-desktop/

### 3. Levantar

```bash
cd backend
cp .env.example .env
# Editar .env con tu GEMINI_API_KEY

cd ..
docker compose up --build -d
```

Dashboard: http://localhost
API: http://localhost:8000

### 4. Configurar Power Automate

1. Ir a https://make.powerautomate.com
2. Crear nuevo flujo → **Automated cloud flow**
3. Trigger: **When a new email arrives (V3)** — Office 365 Outlook
   - Folder: Inbox (o la carpeta del buzón compartido)
   - Include Attachments: No
4. Agregar acción: **HTTP**
   - Method: `POST`
   - URI: `http://<IP-DE-TU-MAQUINA>:8000/api/incoming`
   - Headers: `Content-Type: application/json`
   - Body:
```json
{
  "message_id": "@{triggerOutputs()?['body/id']}",
  "subject": "@{triggerOutputs()?['body/subject']}",
  "sender": "@{triggerOutputs()?['body/from']}",
  "received_at": "@{triggerOutputs()?['body/dateTimeReceived']}",
  "body_preview": "@{triggerOutputs()?['body/bodyPreview']}",
  "conversation_id": "@{triggerOutputs()?['body/conversationId']}",
  "has_attachments": @{triggerOutputs()?['body/hasAttachments']}
}
```
5. Guardar y activar

## Funcionalidades

- ✅ Ingesta automática via Power Automate
- ✅ Categorización IA (Gemini Flash)
- ✅ Backlog con estados: pendiente → en_proceso → respondido → cerrado
- ✅ Filtros por estado, categoría, urgencia, búsqueda
- ✅ Indicador visual de antigüedad (rojo >48h, naranja >24h)
- ✅ Alertas de correos pendientes antiguos
- ✅ Asignación a miembros del equipo
- ✅ Notas por correo
- ✅ Dashboard con métricas
