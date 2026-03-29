from pydantic import BaseModel


class IncomingEmail(BaseModel):
    message_id: str
    subject: str = "(sin asunto)"
    sender: str = "desconocido"
    body: str = ""
    received_at: str  # ISO 8601
    has_attachments: bool = False
    importance: str = "normal"
