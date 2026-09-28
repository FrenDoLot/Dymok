from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import Attachment, Conversation, Message, Notification, PushSubscription, now_utc


DEFAULT_USER_ID = "default-user"


class ConversationService:
    def __init__(self, db: Session):
        self.db = db

    def list_conversations(self, user_id: str = DEFAULT_USER_ID) -> list[Conversation]:
        statement: Select[tuple[Conversation]] = (
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.is_pinned.desc(), Conversation.updated_at.desc())
        )
        return list(self.db.scalars(statement))

    def create_conversation(self, title: str = "Новый чат", user_id: str = DEFAULT_USER_ID) -> Conversation:
        conversation = Conversation(user_id=user_id, title=title or "Новый чат")
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        return conversation

    def get_conversation(self, conversation_id: str, user_id: str = DEFAULT_USER_ID) -> Conversation | None:
        statement = select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user_id)
        return self.db.scalar(statement)

    def delete_conversation(self, conversation_id: str, user_id: str = DEFAULT_USER_ID) -> bool:
        conversation = self.get_conversation(conversation_id, user_id)
        if conversation is None:
            return False
        self.db.delete(conversation)
        self.db.commit()
        return True

    def list_messages(self, conversation_id: str) -> list[Message]:
        statement = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.asc())
        return list(self.db.scalars(statement))

    def add_message(self, conversation_id: str, role: str, content: str, metadata: dict | None = None) -> Message:
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            metadata_json=metadata or {},
        )
        conversation = self.db.get(Conversation, conversation_id)
        if conversation is not None:
            conversation.updated_at = now_utc()
            if conversation.title == "Новый чат" and role == "user":
                conversation.title = content.strip().splitlines()[0][:60] or "Новый чат"
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message


class AttachmentService:
    def __init__(self, db: Session):
        self.db = db

    def save_upload(
        self,
        upload: UploadFile,
        conversation_id: str | None = None,
        user_id: str = DEFAULT_USER_ID,
    ) -> Attachment:
        filename = Path(upload.filename or "attachment").name
        suffix = Path(filename).suffix.lower()
        if suffix not in settings.allowed_upload_extensions:
            raise ValueError(f"Unsupported file type: {suffix or 'no extension'}")
        storage_dir = Path(settings.upload_dir)
        storage_dir.mkdir(parents=True, exist_ok=True)
        storage_name = f"{uuid4()}-{filename}"
        storage_path = storage_dir / storage_name

        size = 0
        with storage_path.open("wb") as output:
            while chunk := upload.file.read(1024 * 1024):
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    output.close()
                    storage_path.unlink(missing_ok=True)
                    raise ValueError("File is too large")
                output.write(chunk)

        attachment = Attachment(
            user_id=user_id,
            conversation_id=conversation_id,
            filename=filename,
            content_type=upload.content_type or "application/octet-stream",
            size_bytes=size,
            storage_path=str(storage_path),
        )
        self.db.add(attachment)
        self.db.commit()
        self.db.refresh(attachment)
        return attachment

    def list_attachments(
        self,
        conversation_id: str | None = None,
        user_id: str = DEFAULT_USER_ID,
    ) -> list[Attachment]:
        statement = select(Attachment).where(Attachment.user_id == user_id).order_by(Attachment.created_at.desc())
        if conversation_id is not None:
            statement = statement.where(Attachment.conversation_id == conversation_id)
        return list(self.db.scalars(statement))

    def get_attachment(self, attachment_id: str, user_id: str = DEFAULT_USER_ID) -> Attachment | None:
        return self.db.scalar(select(Attachment).where(Attachment.id == attachment_id, Attachment.user_id == user_id))

    def attach_to_conversation(self, attachment_ids: list[str], conversation_id: str, user_id: str = DEFAULT_USER_ID) -> list[Attachment]:
        attachments = [
            item
            for item in self.db.scalars(select(Attachment).where(Attachment.id.in_(attachment_ids), Attachment.user_id == user_id))
        ]
        for attachment in attachments:
            if attachment.conversation_id is None:
                attachment.conversation_id = conversation_id
        self.db.commit()
        return attachments


class NotificationService:
    def __init__(self, db: Session):
        self.db = db

    def list_notifications(self, user_id: str = DEFAULT_USER_ID, unread_only: bool = False) -> list[Notification]:
        statement = select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc())
        if unread_only:
            statement = statement.where(Notification.read_at.is_(None))
        return list(self.db.scalars(statement))

    def create_notification(
        self,
        title: str,
        body: str = "",
        level: str = "info",
        source: str = "system",
        metadata: dict | None = None,
        user_id: str = DEFAULT_USER_ID,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            title=title,
            body=body,
            level=level,
            source=source,
            metadata_json=metadata or {},
        )
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)
        return notification

    def mark_read(self, notification_id: str, user_id: str = DEFAULT_USER_ID) -> Notification | None:
        notification = self.db.scalar(
            select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)
        )
        if notification is None:
            return None
        notification.read_at = now_utc()
        self.db.commit()
        self.db.refresh(notification)
        return notification

    def save_push_subscription(self, subscription: dict, user_id: str = DEFAULT_USER_ID) -> PushSubscription:
        endpoint = str(subscription.get("endpoint") or "")
        if not endpoint:
            raise ValueError("Push subscription endpoint is required")
        existing = self.db.scalar(
            select(PushSubscription).where(PushSubscription.user_id == user_id, PushSubscription.endpoint == endpoint)
        )
        if existing is None:
            existing = PushSubscription(user_id=user_id, endpoint=endpoint, subscription_json=subscription)
            self.db.add(existing)
        else:
            existing.subscription_json = subscription
            existing.updated_at = now_utc()
        self.db.commit()
        self.db.refresh(existing)
        return existing
