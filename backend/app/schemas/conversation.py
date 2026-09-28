from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    title: str = "Новый чат"


class ConversationRead(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    is_pinned: bool

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str = Field(min_length=1)


class MessageRead(BaseModel):
    id: str
    conversation_id: str
    role: Literal["user", "assistant", "system"]
    content: str
    created_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


class AttachmentRead(BaseModel):
    id: str
    user_id: str
    conversation_id: str | None
    filename: str
    content_type: str
    size_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    body: str = ""
    level: Literal["info", "success", "warning", "error"] = "info"
    source: str = "system"
    metadata: dict[str, Any] = Field(default_factory=dict)


class NotificationRead(BaseModel):
    id: str
    user_id: str
    title: str
    body: str
    level: str
    source: str
    read_at: datetime | None
    created_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


class PushSubscriptionCreate(BaseModel):
    subscription: dict[str, Any]


class PushSubscriptionRead(BaseModel):
    id: str
    user_id: str
    endpoint: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatStreamRequest(BaseModel):
    conversation_id: str
    content: str = Field(min_length=1)
    autonomy_mode: Literal["chat_only", "ask_before_actions", "autonomous"] | None = None
    attachment_ids: list[str] = Field(default_factory=list)


class StopRequest(BaseModel):
    run_id: str
