from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings
from app.core.middleware import ChatRateLimitMiddleware, SecurityHeadersMiddleware
from app.database.session import init_db


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(ChatRateLimitMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.include_router(router)

    @app.on_event("startup")
    def startup() -> None:
        init_db()

    return app


app = create_app()
