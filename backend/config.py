from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name:    str = "NovaMind"
    app_version: str = "1.0.0"
    app_title:   str = "NovaMind — Amazon Nova Multi-Agent AI"
    app_host:    str = "0.0.0.0"
    app_port:    int = Field(8000, ge=1, le=65535)
    environment: Literal["development", "staging", "production"] = "development"
    debug:       bool = False

    secret_key: str = Field(..., min_length=32)

    allowed_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    aws_region:            str        = "us-east-1"
    aws_access_key_id:     str | None = None
    aws_secret_access_key: str | None = None
    aws_session_token:     str | None = None

    # Text / multimodal 
    nova_lite_model_id:       str = "us.amazon.nova-lite-v1:0"
    nova_pro_model_id:        str = "us.amazon.nova-pro-v1:0"
    # Voice 
    nova_sonic_model_id:      str = "amazon.nova-2-sonic-v1:0"
    # Embeddings
    nova_embed_model_id:      str = "amazon.titan-embed-image-v1"
    nova_text_embed_model_id: str = "amazon.titan-embed-text-v2:0"

    nova_lite_max_tokens:  int   = Field(4096, ge=1,   le=5120)
    nova_lite_temperature: float = Field(0.7,  ge=0.0, le=1.0)
    nova_lite_top_p:       float = Field(0.9,  ge=0.0, le=1.0)

    nova_sonic_sample_rate: int = 24000

    nova_sonic_voice_id: Literal[
        "tiffany", "matthew", "amy", "ruth", "stephen"
    ] = "tiffany"

    faiss_index_path:    str = "./data/faiss_index"
    embedding_dimension: int = Field(1024, ge=64,  le=4096)
    max_retrieval_docs:  int = Field(5,    ge=1,   le=20)

    upload_dir:         str       = "./data/uploads"
    max_upload_size_mb: int       = Field(20, ge=1, le=500)
    allowed_extensions: list[str] = [
        "pdf", "txt", "md", "png", "jpg", "jpeg", "webp",
    ]

    agent_max_iterations:  int  = Field(8,  ge=1, le=25)
    agent_verbose:         bool = True
    conversation_memory_k: int  = Field(10, ge=1, le=50)

    log_level:  Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    log_format: Literal["json", "console"] = "console"

    @field_validator("nova_sonic_sample_rate", mode="before")
    @classmethod
    def _validate_sample_rate(cls, v: object) -> int:
        """
        Coerce and validate NOVA_SONIC_SAMPLE_RATE from .env (arrives as str).

        Nova Sonic valid sample rates:
          Input  (mic → Nova):     8000 | 16000 Hz
          Output (Nova → browser): 8000 | 24000 Hz

        16000 Hz is not a valid Nova output rate. Playing 24 kHz PCM in a
        16 kHz AudioContext results in 66.7 % speed and a pitch shift.
        Always use 24000 for output.
        """
        try:
            v_int = int(v) 
        except (TypeError, ValueError):
            raise ValueError(
                f"NOVA_SONIC_SAMPLE_RATE must be an integer, got {v!r}"
            )
        _VALID = {8_000, 16_000, 24_000}
        if v_int not in _VALID:
            raise ValueError(
                f"NOVA_SONIC_SAMPLE_RATE must be one of {sorted(_VALID)}, got {v_int}. "
                "For output (Nova → browser) use 24000. "
                "For input (mic → Nova) use 8000 or 16000."
            )
        return v_int

    @field_validator("secret_key")
    @classmethod
    def _validate_secret_key(cls, v: str) -> str:
        """Reject placeholder, whitespace-only, and padded values."""
        if v != v.strip():
            raise ValueError(
                "SECRET_KEY must not have leading/trailing whitespace. "
                "Check your .env for copy-paste artefacts."
            )
        if not v.strip():
            raise ValueError("SECRET_KEY must not be all whitespace.")
        if "REPLACE_WITH" in v.upper():
            raise ValueError(
                "SECRET_KEY is still the placeholder from .env.example. "
                "Generate a real key with:  "
                "python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return v

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return the singleton Settings instance.
    .env is parsed exactly once per process.
    Never call Settings() directly.
    """
    return Settings()


_s        = get_settings()
APP_TITLE = _s.app_title
APP_HOST  = _s.app_host
APP_PORT  = _s.app_port
DEBUG     = _s.debug