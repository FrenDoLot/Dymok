import json
from collections.abc import AsyncIterator
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.providers.openclaw import create_provider
from app.schemas.agent import (
    AgentRunRead,
    ApprovalRead,
    AuditLogRead,
    PermissionsRead,
    PermissionsUpdate,
    PermissionRuleRead,
    TaskCreate,
    TaskRead,
    ToolCallRead,
)
from app.schemas.conversation import (
    AttachmentRead,
    ChatStreamRequest,
    ConversationCreate,
    ConversationRead,
    MessageCreate,
    MessageRead,
    NotificationCreate,
    NotificationRead,
    PushSubscriptionCreate,
    PushSubscriptionRead,
    StopRequest,
)
from app.services.agent_system import AgentSystemService
from app.services.conversations import AttachmentService, ConversationService, NotificationService


router = APIRouter(prefix="/api")
provider = create_provider()


def serialize_message(message) -> MessageRead:
    return MessageRead(
        id=message.id,
        conversation_id=message.conversation_id,
        role=message.role,
        content=message.content,
        created_at=message.created_at,
        metadata=message.metadata_json or {},
    )


def serialize_tool_call(tool_call) -> ToolCallRead:
    return ToolCallRead(
        id=tool_call.id,
        message_id=tool_call.message_id,
        agent_run_id=tool_call.agent_run_id,
        tool_name=tool_call.tool_name,
        status=tool_call.status,
        input=tool_call.input_json or {},
        result=tool_call.result_json or {},
        started_at=tool_call.started_at,
        completed_at=tool_call.completed_at,
    )


def serialize_attachment(attachment) -> AttachmentRead:
    return AttachmentRead.model_validate(attachment)


def serialize_notification(notification) -> NotificationRead:
    return NotificationRead(
        id=notification.id,
        user_id=notification.user_id,
        title=notification.title,
        body=notification.body,
        level=notification.level,
        source=notification.source,
        read_at=notification.read_at,
        created_at=notification.created_at,
        metadata=notification.metadata_json or {},
    )


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def detect_action_category(text: str) -> tuple[str, str] | None:
    normalized = text.lower()
    checks = [
        ("send_email", ("send email", "отправь письмо", "напиши письмо", "email")),
        ("external_messages", ("send message", "отправь сообщение", "напиши в telegram", "напиши в телеграм")),
        ("delete_files", ("delete file", "удали файл", "удалить файл", "rm -rf")),
        ("write_files", ("write file", "создай файл", "измени файл", "запиши файл")),
        ("system_commands", ("run command", "выполни команду", "запусти команду", "shell")),
    ]
    for category, markers in checks:
        if any(marker in normalized for marker in markers):
            return category, markers[0]
    return None


@router.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "service": "dymok-web",
        "agent_provider": settings.agent_provider,
        "openclaw": {
            "mode": "configured" if settings.agent_provider.startswith("openclaw_") else "mock",
            "connected": settings.agent_provider.startswith("openclaw_"),
        },
        "background_ai_calls": False,
    }


@router.get("/conversations", response_model=list[ConversationRead])
def list_conversations(db: Session = Depends(get_db)):
    return ConversationService(db).list_conversations()


@router.post("/conversations", response_model=ConversationRead)
def create_conversation(payload: ConversationCreate, db: Session = Depends(get_db)):
    return ConversationService(db).create_conversation(payload.title)


@router.get("/conversations/{conversation_id}", response_model=ConversationRead)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conversation = ConversationService(db).get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    deleted = ConversationService(db).delete_conversation(conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"ok": True}


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageRead])
def list_messages(conversation_id: str, db: Session = Depends(get_db)):
    service = ConversationService(db)
    if service.get_conversation(conversation_id) is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return [serialize_message(message) for message in service.list_messages(conversation_id)]


@router.post("/conversations/{conversation_id}/messages", response_model=MessageRead)
def add_message(conversation_id: str, payload: MessageCreate, db: Session = Depends(get_db)):
    service = ConversationService(db)
    if service.get_conversation(conversation_id) is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return serialize_message(service.add_message(conversation_id, "user", payload.content))


@router.post("/chat/stream")
async def stream_chat(payload: ChatStreamRequest, db: Session = Depends(get_db)):
    service = ConversationService(db)
    if service.get_conversation(payload.conversation_id) is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    user_message = service.add_message(payload.conversation_id, "user", payload.content)
    if payload.attachment_ids:
        attachments = AttachmentService(db).attach_to_conversation(payload.attachment_ids, payload.conversation_id)
        if len(attachments) != len(set(payload.attachment_ids)):
            raise HTTPException(status_code=400, detail="One or more attachments were not found")
        user_message.metadata_json = {
            **(user_message.metadata_json or {}),
            "attachments": [serialize_attachment(item).model_dump(mode="json") for item in attachments],
        }
        db.commit()
        db.refresh(user_message)
    run_id = str(uuid4())
    agent_service = AgentSystemService(db)
    agent_service.create_agent_run(payload.conversation_id, autonomy_mode=payload.autonomy_mode, run_id=run_id)
    autonomy_mode = payload.autonomy_mode or agent_service.get_autonomy_mode()
    detected_action = detect_action_category(payload.content)
    tool_call = agent_service.create_tool_call(
        agent_run_id=run_id,
        message_id=user_message.id,
        tool_name=detected_action[0] if detected_action else settings.agent_provider,
        input_data={"conversation_id": payload.conversation_id, "category": detected_action[0] if detected_action else "chat"},
    )

    async def events() -> AsyncIterator[str]:
        assistant_parts: list[str] = []
        yield sse("run", {"run_id": run_id})
        yield sse("message", {"message": serialize_message(user_message).model_dump(mode="json")})
        yield sse("activity", {"run_id": run_id, "status": "running", "label": "AgentRun запущен"})
        if detected_action is not None:
            category, _marker = detected_action
            decision = agent_service.permission_decision(category, autonomy_mode)
            if decision == "DENY":
                text = f"В режиме {autonomy_mode} действие `{category}` запрещено backend permission matrix."
                agent_service.set_tool_call_status(tool_call.id, "denied")
                agent_service.update_agent_run(run_id, "completed", current_step="Действие запрещено", result=text)
                assistant_message = service.add_message(
                    payload.conversation_id,
                    "assistant",
                    text,
                    metadata={"provider": "permission-gate", "run_id": run_id},
                )
                yield sse("token", {"text": text})
                yield sse("message", {"message": serialize_message(assistant_message).model_dump(mode="json")})
                yield sse("done", {"ok": True})
                return
            if decision == "ASK":
                approval = agent_service.create_approval(
                    agent_run_id=run_id,
                    tool_call_id=tool_call.id,
                    title=f"Дымок хочет выполнить: {category}",
                    description=payload.content[:500],
                )
                text = "Нужно подтверждение перед внешним действием."
                agent_service.set_tool_call_status(tool_call.id, "waiting_for_approval")
                agent_service.update_agent_run(run_id, "waiting_for_approval", current_step=text)
                assistant_message = service.add_message(
                    payload.conversation_id,
                    "assistant",
                    text,
                    metadata={"provider": "permission-gate", "run_id": run_id, "approval_id": approval.id},
                )
                yield sse("approval", {"approval": ApprovalRead.model_validate(approval).model_dump(mode="json")})
                yield sse("message", {"message": serialize_message(assistant_message).model_dump(mode="json")})
                yield sse("done", {"ok": True})
                return
        try:
            async for event in provider.stream_message(payload.conversation_id, payload.content, run_id):
                if event.event == "token":
                    assistant_parts.append(event.data.get("text", ""))
                if event.event == "status":
                    agent_service.update_agent_run(run_id, "running", current_step=event.data.get("label"))
                if event.event == "done":
                    continue
                yield sse(event.event, event.data)
            assistant_text = "".join(assistant_parts).strip()
            assistant_message = service.add_message(
                payload.conversation_id,
                "assistant",
                assistant_text,
                metadata={"provider": settings.agent_provider, "run_id": run_id},
            )
            agent_service.complete_tool_call(tool_call.id, "completed", {"message_id": assistant_message.id})
            agent_service.update_agent_run(run_id, "completed", current_step="Готово", result=assistant_text)
            yield sse("message", {"message": serialize_message(assistant_message).model_dump(mode="json")})
            yield sse("activity", {"run_id": run_id, "status": "completed", "label": "AgentRun завершён"})
            yield sse("done", {"ok": True})
        except Exception as exc:
            agent_service.complete_tool_call(tool_call.id, "failed", error=str(exc))
            agent_service.update_agent_run(run_id, "failed", current_step="Ошибка", error=str(exc))
            yield sse("error", {"message": "Streaming failed", "detail": str(exc)})

    return StreamingResponse(events(), media_type="text/event-stream")


@router.post("/chat/stop")
async def stop_chat(payload: StopRequest):
    await provider.stop_generation(payload.run_id)
    return {"ok": True}


@router.get("/models")
async def models():
    return {"models": await provider.get_available_models()}


@router.get("/tools")
async def tools():
    return {"tools": await provider.get_available_tools()}


@router.get("/attachments", response_model=list[AttachmentRead])
def list_attachments(conversation_id: str | None = None, db: Session = Depends(get_db)):
    return [serialize_attachment(item) for item in AttachmentService(db).list_attachments(conversation_id)]


@router.post("/attachments", response_model=AttachmentRead)
def upload_attachment(
    conversation_id: str | None = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if conversation_id and ConversationService(db).get_conversation(conversation_id) is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    try:
        return serialize_attachment(AttachmentService(db).save_upload(file, conversation_id=conversation_id))
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc


@router.get("/attachments/{attachment_id}/download")
def download_attachment(attachment_id: str, db: Session = Depends(get_db)):
    attachment = AttachmentService(db).get_attachment(attachment_id)
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if not Path(attachment.storage_path).is_file():
        raise HTTPException(status_code=404, detail="Attachment file is missing")
    return FileResponse(
        attachment.storage_path,
        media_type=attachment.content_type,
        filename=attachment.filename,
    )


@router.get("/notifications", response_model=list[NotificationRead])
def list_notifications(unread_only: bool = False, db: Session = Depends(get_db)):
    return [
        serialize_notification(item)
        for item in NotificationService(db).list_notifications(unread_only=unread_only)
    ]


@router.post("/notifications", response_model=NotificationRead)
def create_notification(payload: NotificationCreate, db: Session = Depends(get_db)):
    notification = NotificationService(db).create_notification(
        title=payload.title,
        body=payload.body,
        level=payload.level,
        source=payload.source,
        metadata=payload.metadata,
    )
    return serialize_notification(notification)


@router.post("/notifications/test", response_model=NotificationRead)
def create_test_notification(db: Session = Depends(get_db)):
    return serialize_notification(
        NotificationService(db).create_notification(
            title="Проверка уведомлений",
            body="Notification Center подключён. Push subscription API готов для web-push провайдера.",
            source="stage4-smoke",
        )
    )


@router.post("/notifications/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(notification_id: str, db: Session = Depends(get_db)):
    notification = NotificationService(db).mark_read(notification_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    return serialize_notification(notification)


@router.post("/push-subscriptions", response_model=PushSubscriptionRead)
def save_push_subscription(payload: PushSubscriptionCreate, db: Session = Depends(get_db)):
    try:
        return NotificationService(db).save_push_subscription(payload.subscription)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/tasks", response_model=list[TaskRead])
def list_tasks(db: Session = Depends(get_db)):
    return AgentSystemService(db).list_tasks()


@router.post("/tasks", response_model=TaskRead)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    return AgentSystemService(db).create_task(payload.title, payload.description)


@router.get("/tasks/{task_id}", response_model=TaskRead)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = AgentSystemService(db).get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/tasks/{task_id}/cancel", response_model=TaskRead)
def cancel_task(task_id: str, db: Session = Depends(get_db)):
    task = AgentSystemService(db).cancel_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/agent-runs", response_model=list[AgentRunRead])
def list_agent_runs(db: Session = Depends(get_db)):
    return AgentSystemService(db).list_agent_runs()


@router.get("/agent-runs/{run_id}", response_model=AgentRunRead)
def get_agent_run(run_id: str, db: Session = Depends(get_db)):
    run = AgentSystemService(db).get_agent_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="AgentRun not found")
    return run


@router.post("/agent-runs/{run_id}/stop")
async def stop_agent_run(run_id: str, db: Session = Depends(get_db)):
    await provider.stop_generation(run_id)
    AgentSystemService(db).update_agent_run(run_id, "cancelled", current_step="Остановлено")
    return {"ok": True}


@router.get("/tool-calls", response_model=list[ToolCallRead])
def list_tool_calls(agent_run_id: str | None = None, db: Session = Depends(get_db)):
    return [serialize_tool_call(item) for item in AgentSystemService(db).list_tool_calls(agent_run_id)]


@router.get("/approvals", response_model=list[ApprovalRead])
def list_approvals(db: Session = Depends(get_db)):
    return AgentSystemService(db).list_approvals()


@router.post("/approvals/{approval_id}/approve", response_model=ApprovalRead)
def approve(approval_id: str, db: Session = Depends(get_db)):
    approval = AgentSystemService(db).resolve_approval(approval_id, "approved")
    if approval is None:
        raise HTTPException(status_code=404, detail="Approval not found")
    return approval


@router.post("/approvals/{approval_id}/reject", response_model=ApprovalRead)
def reject(approval_id: str, db: Session = Depends(get_db)):
    approval = AgentSystemService(db).resolve_approval(approval_id, "rejected")
    if approval is None:
        raise HTTPException(status_code=404, detail="Approval not found")
    return approval


@router.get("/permissions", response_model=PermissionsRead)
def get_permissions(db: Session = Depends(get_db)):
    mode, rules = AgentSystemService(db).get_permissions()
    return PermissionsRead(
        autonomy_mode=mode,
        rules=[PermissionRuleRead(category=item.category, decision=item.decision) for item in rules],
    )


@router.put("/permissions", response_model=PermissionsRead)
def update_permissions(payload: PermissionsUpdate, db: Session = Depends(get_db)):
    mode, rules = AgentSystemService(db).update_permissions(payload)
    return PermissionsRead(
        autonomy_mode=mode,
        rules=[PermissionRuleRead(category=item.category, decision=item.decision) for item in rules],
    )


@router.get("/audit", response_model=list[AuditLogRead])
def list_audit(limit: int = 100, db: Session = Depends(get_db)):
    return AgentSystemService(db).list_audit(limit=min(max(limit, 1), 500))
