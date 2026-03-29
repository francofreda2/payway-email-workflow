from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    notification_email: str = ""
    alert_hours_threshold: int = 24
    database_url: str = "sqlite:///./backlog.db"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
