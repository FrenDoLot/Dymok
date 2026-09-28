from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    app_name: str = "Dymok"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./dymok.db")
    agent_provider: str = os.getenv("AGENT_PROVIDER", "mock")
    openclaw_api_url: str = os.getenv("OPENCLAW_API_URL", "")
    openclaw_api_key: str = os.getenv("OPENCLAW_API_KEY", "")
    openclaw_command: str = os.getenv("OPENCLAW_COMMAND", "openclaw")
    openclaw_path_prefix: str = os.getenv("OPENCLAW_PATH_PREFIX", "")
    openclaw_gateway_url: str = os.getenv("OPENCLAW_GATEWAY_URL", "ws://127.0.0.1:18789")
    openclaw_gateway_client_module: str = os.getenv(
        "OPENCLAW_GATEWAY_CLIENT_MODULE",
        "/opt/homebrew/lib/node_modules/openclaw/dist/gateway-chat-C7bhNw-W.js",
    )
    openclaw_agent_id: str = os.getenv("OPENCLAW_AGENT_ID", "main")
    openclaw_model: str = os.getenv("OPENCLAW_MODEL", "")
    openclaw_timeout_seconds: int = int(os.getenv("OPENCLAW_TIMEOUT_SECONDS", "120"))
    openclaw_circuit_breaker_seconds: int = int(os.getenv("OPENCLAW_CIRCUIT_BREAKER_SECONDS", "3600"))
    chat_rate_limit_per_minute: int = int(os.getenv("CHAT_RATE_LIMIT_PER_MINUTE", "20"))
    upload_dir: str = os.getenv("UPLOAD_DIR", "storage/uploads")
    max_upload_bytes: int = int(os.getenv("MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
    allowed_upload_extensions: tuple[str, ...] = tuple(
        item.strip().lower()
        for item in os.getenv(
            "ALLOWED_UPLOAD_EXTENSIONS",
            ".png,.jpg,.jpeg,.webp,.pdf,.txt,.md,.markdown,.csv,.json,.py,.js,.ts,.tsx,.jsx,.html,.css,.xml,.yaml,.yml,.doc,.docx",
        ).split(",")
        if item.strip()
    )
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    )


settings = Settings()
