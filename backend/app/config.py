from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables / backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Scaler Meet"

    # Anchored to the backend directory so the DB location does not depend on CWD.
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'scaler.db').as_posix()}"
    cors_origins: str = "http://localhost:3000"
    stun_server: str = "stun:stun.l.google.com:19302"
    turn_server: str | None = None
    turn_username: str | None = None
    turn_credential: str | None = None
    ice_servers_json: str | None = None

    # Optional Clerk bonus authentication (backend verification of Clerk session JWTs).
    clerk_secret_key: str | None = None
    clerk_issuer: str | None = None

    # Mock/default user (guaranteed execution path when Clerk is not configured).
    default_user_id: str = "usr_default_host"
    default_user_name: str = "Demo User"
    default_user_email: str = "demo@example.com"

    chat_history_limit: int = 50
    chat_message_max_length: int = 2000
    display_name_max_length: int = 50

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
