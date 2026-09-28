from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import AgentRun, Approval, AuditLog, PermissionRule, Task, ToolCall, UserSetting, now_utc
from app.schemas.agent import PermissionsUpdate
from app.services.conversations import DEFAULT_USER_ID


DEFAULT_PERMISSION_RULES = [
    ("web_search", "ALLOW"),
    ("read_files", "ALLOW"),
    ("write_files", "ASK"),
    ("google_sheets", "ALLOW"),
    ("send_email", "ASK"),
    ("delete_files", "DENY"),
    ("system_commands", "ASK"),
    ("external_messages", "ASK"),
]


class AgentSystemService:
    def __init__(self, db: Session):
        self.db = db

    def create_task(self, title: str, description: str = "", user_id: str = DEFAULT_USER_ID) -> Task:
        task = Task(user_id=user_id, title=title, description=description)
        self.db.add(task)
        self.audit(user_id=user_id, action="task.created", result=title)
        self.db.commit()
        self.db.refresh(task)
        return task

    def list_tasks(self, user_id: str = DEFAULT_USER_ID) -> list[Task]:
        return list(self.db.scalars(select(Task).where(Task.user_id == user_id).order_by(Task.updated_at.desc())))

    def get_task(self, task_id: str, user_id: str = DEFAULT_USER_ID) -> Task | None:
        return self.db.scalar(select(Task).where(Task.id == task_id, Task.user_id == user_id))

    def cancel_task(self, task_id: str, user_id: str = DEFAULT_USER_ID) -> Task | None:
        task = self.get_task(task_id, user_id)
        if task is None:
            return None
        task.status = "cancelled"
        task.updated_at = now_utc()
        self.audit(user_id=user_id, action="task.cancelled", result=task.title)
        self.db.commit()
        self.db.refresh(task)
        return task

    def create_agent_run(
        self,
        conversation_id: str | None,
        task_id: str | None = None,
        autonomy_mode: str | None = None,
        run_id: str | None = None,
        user_id: str = DEFAULT_USER_ID,
    ) -> AgentRun:
        run = AgentRun(
            id=run_id,
            user_id=user_id,
            conversation_id=conversation_id,
            task_id=task_id,
            status="running",
            autonomy_mode=autonomy_mode or self.get_autonomy_mode(user_id),
            current_step="queued",
        )
        self.db.add(run)
        self.db.flush()
        self.audit(
            user_id=user_id,
            agent_run_id=run.id,
            action="agent.run.started",
            autonomy_mode=run.autonomy_mode,
            approval_required=False,
        )
        self.db.commit()
        self.db.refresh(run)
        return run

    def list_agent_runs(self, user_id: str = DEFAULT_USER_ID) -> list[AgentRun]:
        return list(self.db.scalars(select(AgentRun).where(AgentRun.user_id == user_id).order_by(AgentRun.started_at.desc())))

    def get_agent_run(self, run_id: str, user_id: str = DEFAULT_USER_ID) -> AgentRun | None:
        return self.db.scalar(select(AgentRun).where(AgentRun.id == run_id, AgentRun.user_id == user_id))

    def update_agent_run(
        self,
        run_id: str,
        status: str,
        current_step: str | None = None,
        result: str | None = None,
        error: str | None = None,
        user_id: str = DEFAULT_USER_ID,
    ) -> AgentRun | None:
        run = self.get_agent_run(run_id, user_id)
        if run is None:
            return None
        run.status = status
        if current_step is not None:
            run.current_step = current_step
        run.result = result
        run.error = error
        if status in {"completed", "failed", "cancelled"}:
            run.completed_at = now_utc()
        if status != "running" or result is not None or error is not None:
            self.audit(
                user_id=user_id,
                agent_run_id=run.id,
                action=f"agent.run.{status}",
                autonomy_mode=run.autonomy_mode,
                result=result,
                error=error,
            )
        self.db.commit()
        self.db.refresh(run)
        return run

    def create_tool_call(
        self,
        agent_run_id: str,
        tool_name: str,
        input_data: dict | None = None,
        message_id: str | None = None,
        user_id: str = DEFAULT_USER_ID,
    ) -> ToolCall:
        tool_call = ToolCall(
            agent_run_id=agent_run_id,
            message_id=message_id,
            tool_name=tool_name,
            status="running",
            input_json=self._scrub(input_data or {}),
        )
        self.db.add(tool_call)
        self.db.flush()
        self.audit(
            user_id=user_id,
            agent_run_id=agent_run_id,
            tool_call_id=tool_call.id,
            tool_name=tool_name,
            action="tool.action.started",
        )
        self.db.commit()
        self.db.refresh(tool_call)
        return tool_call

    def complete_tool_call(
        self,
        tool_call_id: str,
        status: str,
        result_data: dict | None = None,
        error: str | None = None,
        user_id: str = DEFAULT_USER_ID,
    ) -> ToolCall | None:
        tool_call = self.db.get(ToolCall, tool_call_id)
        if tool_call is None:
            return None
        tool_call.status = status
        tool_call.result_json = self._scrub(result_data or {})
        tool_call.completed_at = now_utc()
        self.audit(
            user_id=user_id,
            agent_run_id=tool_call.agent_run_id,
            tool_call_id=tool_call.id,
            tool_name=tool_call.tool_name,
            action=f"tool.action.{status}",
            result=status,
            error=error,
        )
        self.db.commit()
        self.db.refresh(tool_call)
        return tool_call

    def set_tool_call_status(
        self,
        tool_call_id: str,
        status: str,
        user_id: str = DEFAULT_USER_ID,
    ) -> ToolCall | None:
        tool_call = self.db.get(ToolCall, tool_call_id)
        if tool_call is None:
            return None
        tool_call.status = status
        self.audit(
            user_id=user_id,
            agent_run_id=tool_call.agent_run_id,
            tool_call_id=tool_call.id,
            tool_name=tool_call.tool_name,
            action=f"tool.action.{status}",
        )
        self.db.commit()
        self.db.refresh(tool_call)
        return tool_call

    def list_tool_calls(self, agent_run_id: str | None = None) -> list[ToolCall]:
        statement = select(ToolCall).order_by(ToolCall.started_at.desc())
        if agent_run_id:
            statement = statement.where(ToolCall.agent_run_id == agent_run_id)
        return list(self.db.scalars(statement))

    def list_approvals(self) -> list[Approval]:
        return list(self.db.scalars(select(Approval).order_by(Approval.created_at.desc())))

    def create_approval(
        self,
        agent_run_id: str,
        title: str,
        description: str,
        tool_call_id: str | None = None,
        user_id: str = DEFAULT_USER_ID,
    ) -> Approval:
        approval = Approval(
            agent_run_id=agent_run_id,
            tool_call_id=tool_call_id,
            title=title,
            description=description,
            status="pending",
        )
        self.db.add(approval)
        self.audit(
            user_id=user_id,
            agent_run_id=agent_run_id,
            tool_call_id=tool_call_id,
            action="approval.requested",
            approval_required=True,
            result=title,
        )
        self.db.commit()
        self.db.refresh(approval)
        return approval

    def resolve_approval(self, approval_id: str, status: str) -> Approval | None:
        approval = self.db.get(Approval, approval_id)
        if approval is None:
            return None
        if approval.status != "pending":
            return approval
        approval.status = status
        approval.decided_at = now_utc()
        if approval.tool_call_id:
            tool_call = self.db.get(ToolCall, approval.tool_call_id)
            if tool_call:
                if status == "approved":
                    tool_call.status = "approved"
                    tool_call.result_json = {"approval_id": approval.id, "decision": status}
                else:
                    tool_call.status = "rejected"
                    tool_call.result_json = {"approval_id": approval.id, "decision": status}
                tool_call.completed_at = now_utc()
        run = self.get_agent_run(approval.agent_run_id)
        if run:
            run.status = "completed"
            run.current_step = "Подтверждение получено" if status == "approved" else "Действие отклонено"
            run.result = f"Approval {status}: {approval.title}"
            run.completed_at = now_utc()
        self.audit(
            user_id=DEFAULT_USER_ID,
            agent_run_id=approval.agent_run_id,
            tool_call_id=approval.tool_call_id,
            action=f"approval.{status}",
            approval_required=True,
            result=approval.title,
        )
        self.audit(
            user_id=DEFAULT_USER_ID,
            agent_run_id=approval.agent_run_id,
            tool_call_id=approval.tool_call_id,
            action=f"agent.run.completed_after_{status}",
            approval_required=True,
            result=approval.title,
        )
        self.db.commit()
        self.db.refresh(approval)
        return approval

    def get_permissions(self, user_id: str = DEFAULT_USER_ID) -> tuple[str, list[PermissionRule]]:
        self.ensure_default_permissions(user_id)
        return self.get_autonomy_mode(user_id), list(
            self.db.scalars(select(PermissionRule).where(PermissionRule.user_id == user_id).order_by(PermissionRule.category))
        )

    def permission_decision(self, category: str, autonomy_mode: str, user_id: str = DEFAULT_USER_ID) -> str:
        self.ensure_default_permissions(user_id)
        if autonomy_mode == "chat_only":
            return "DENY"
        rule = self.db.scalar(
            select(PermissionRule).where(PermissionRule.user_id == user_id, PermissionRule.category == category)
        )
        decision = rule.decision if rule else "ASK"
        if autonomy_mode == "ask_before_actions" and decision == "ALLOW":
            return "ASK"
        return decision

    def update_permissions(self, payload: PermissionsUpdate, user_id: str = DEFAULT_USER_ID) -> tuple[str, list[PermissionRule]]:
        self.set_autonomy_mode(payload.autonomy_mode, user_id)
        existing = {
            rule.category: rule
            for rule in self.db.scalars(select(PermissionRule).where(PermissionRule.user_id == user_id))
        }
        for item in payload.rules:
            rule = existing.get(item.category)
            if rule is None:
                self.db.add(PermissionRule(user_id=user_id, category=item.category, decision=item.decision))
            else:
                rule.decision = item.decision
                rule.updated_at = now_utc()
        self.audit(user_id=user_id, action="permissions.updated", result=payload.autonomy_mode)
        self.db.commit()
        return self.get_permissions(user_id)

    def ensure_default_permissions(self, user_id: str = DEFAULT_USER_ID) -> None:
        existing = {
            rule.category
            for rule in self.db.scalars(select(PermissionRule).where(PermissionRule.user_id == user_id))
        }
        changed = False
        for category, decision in DEFAULT_PERMISSION_RULES:
            if category not in existing:
                self.db.add(PermissionRule(user_id=user_id, category=category, decision=decision))
                changed = True
        if self._get_setting("autonomy_mode", user_id) is None:
            self._set_setting("autonomy_mode", {"value": "ask_before_actions"}, user_id)
            changed = True
        if changed:
            self.db.commit()

    def get_autonomy_mode(self, user_id: str = DEFAULT_USER_ID) -> str:
        setting = self._get_setting("autonomy_mode", user_id)
        return setting.get("value", "ask_before_actions") if setting else "ask_before_actions"

    def set_autonomy_mode(self, mode: str, user_id: str = DEFAULT_USER_ID) -> None:
        self._set_setting("autonomy_mode", {"value": mode}, user_id)

    def list_audit(self, limit: int = 100, user_id: str = DEFAULT_USER_ID) -> list[AuditLog]:
        return list(
            self.db.scalars(
                select(AuditLog).where(AuditLog.user_id == user_id).order_by(AuditLog.timestamp.desc()).limit(limit)
            )
        )

    def audit(
        self,
        user_id: str,
        action: str,
        agent_run_id: str | None = None,
        tool_call_id: str | None = None,
        tool_name: str | None = None,
        autonomy_mode: str | None = None,
        permission_decision: str | None = None,
        approval_required: bool = False,
        result: str | None = None,
        error: str | None = None,
    ) -> None:
        self.db.add(
            AuditLog(
                user_id=user_id,
                agent_run_id=agent_run_id,
                tool_call_id=tool_call_id,
                tool_name=tool_name,
                action=action,
                autonomy_mode=autonomy_mode,
                permission_decision=permission_decision,
                approval_required=approval_required,
                result=result,
                error=error,
            )
        )

    def _get_setting(self, key: str, user_id: str) -> dict | None:
        setting = self.db.scalar(select(UserSetting).where(UserSetting.user_id == user_id, UserSetting.key == key))
        return setting.value_json if setting else None

    def _set_setting(self, key: str, value: dict, user_id: str) -> None:
        setting = self.db.scalar(select(UserSetting).where(UserSetting.user_id == user_id, UserSetting.key == key))
        if setting is None:
            self.db.add(UserSetting(user_id=user_id, key=key, value_json=value))
        else:
            setting.value_json = value
            setting.updated_at = now_utc()

    def _scrub(self, data: dict) -> dict:
        secret_keys = {"api_key", "apikey", "password", "token", "cookie", "secret", "authorization"}
        scrubbed = {}
        for key, value in data.items():
            scrubbed[key] = "[redacted]" if key.lower() in secret_keys else value
        return scrubbed
