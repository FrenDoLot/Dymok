from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


AutonomyMode = Literal["chat_only", "ask_before_actions", "autonomous"]
PermissionDecision = Literal["ALLOW", "ASK", "DENY"]


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    description: str = ""


class TaskRead(BaseModel):
    id: str
    user_id: str
    title: str
    description: str
    status: str
    created_at: datetime
    updated_at: datetime
    result: str | None

    model_config = {"from_attributes": True}


class AgentRunRead(BaseModel):
    id: str
    user_id: str
    conversation_id: str | None
    task_id: str | None
    status: str
    autonomy_mode: str
    started_at: datetime
    completed_at: datetime | None
    current_step: str | None
    result: str | None
    error: str | None

    model_config = {"from_attributes": True}


class ToolCallRead(BaseModel):
    id: str
    message_id: str | None
    agent_run_id: str
    tool_name: str
    status: str
    input: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] = Field(default_factory=dict)
    started_at: datetime
    completed_at: datetime | None


class ApprovalRead(BaseModel):
    id: str
    agent_run_id: str
    tool_call_id: str | None
    title: str
    description: str
    status: str
    created_at: datetime
    decided_at: datetime | None

    model_config = {"from_attributes": True}


class PermissionRuleRead(BaseModel):
    category: str
    decision: PermissionDecision


class PermissionsRead(BaseModel):
    autonomy_mode: AutonomyMode
    rules: list[PermissionRuleRead]


class PermissionsUpdate(BaseModel):
    autonomy_mode: AutonomyMode
    rules: list[PermissionRuleRead]


class AuditLogRead(BaseModel):
    id: str
    user_id: str
    agent_run_id: str | None
    tool_call_id: str | None
    timestamp: datetime
    tool_name: str | None
    action: str
    autonomy_mode: str | None
    permission_decision: str | None
    approval_required: bool
    result: str | None
    error: str | None

    model_config = {"from_attributes": True}
