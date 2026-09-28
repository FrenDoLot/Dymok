from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app.models.entities import (
        AgentRun,
        Approval,
        Attachment,
        AuditLog,
        Conversation,
        Message,
        PermissionRule,
        Task,
        ToolCall,
        User,
        UserSetting,
    )

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        user = db.get(User, "default-user")
        if user is None:
            db.add(User(id="default-user", username="slava"))
            db.commit()
