import asyncio
import json
import os
import shutil
import time
from pathlib import Path
from asyncio.subprocess import Process
from collections.abc import AsyncIterator

from app.core.config import Settings, settings
from app.providers.base import AgentProvider, StreamEvent


class AgentProviderError(RuntimeError):
    pass


class AgentProviderQuotaError(AgentProviderError):
    pass


class MockOpenClawProvider(AgentProvider):
    async def stream_message(self, conversation_id: str, message: str, run_id: str):
        yield StreamEvent("run", {"run_id": run_id, "provider": "mock"})
        yield StreamEvent("status", {"status": "connecting", "label": "Подключение..."})
        await asyncio.sleep(0.12)
        yield StreamEvent("status", {"status": "thinking", "label": "Дымок думает..."})
        await asyncio.sleep(0.2)

        response = self._build_response(message)
        for token in response.split(" "):
            await asyncio.sleep(0.035)
            yield StreamEvent("token", {"text": token + " "})

        yield StreamEvent("status", {"status": "done", "label": "Готово"})

    async def stop_generation(self, run_id: str) -> None:
        return None

    async def get_available_models(self) -> list[dict]:
        return [{"id": "mock-dymok", "name": "Дымок Mock", "provider": "mock"}]

    async def get_available_tools(self) -> list[dict]:
        return [{"id": "mock-chat", "name": "Mock Chat", "safe": True}]

    def _build_response(self, message: str) -> str:
        clean = message.strip()
        if not clean:
            return "Я здесь. Напиши задачу, и разберём её спокойно."
        return (
            f"Принял: **{clean[:160]}**.\n\n"
            "Это mock-ответ Этапа 1: история сохраняется в SQLite, ответ приходит потоком через SSE, "
            "а OpenClaw пока не вызывается. Никаких фоновых обращений к модели здесь нет."
        )


class OpenClawCliProvider(AgentProvider):
    quota_markers = (
        "rate limit",
        "usage limit",
        "quota exhausted",
        "cooldown",
        "subscription usage limit",
        "too many requests",
    )

    def __init__(self, config: Settings):
        self.config = config
        self._active: dict[str, Process] = {}
        self._circuit_open_until = 0.0

    async def stream_message(self, conversation_id: str, message: str, run_id: str) -> AsyncIterator[StreamEvent]:
        yield StreamEvent("run", {"run_id": run_id, "provider": "openclaw_cli"})
        yield StreamEvent("status", {"status": "connecting", "label": "Подключение к OpenClaw..."})

        if self._circuit_open_until > time.time():
            seconds_left = int(self._circuit_open_until - time.time())
            raise AgentProviderQuotaError(f"OpenClaw circuit breaker is active for {seconds_left}s")

        process: Process | None = None
        try:
            process = await asyncio.create_subprocess_exec(
                *self._build_command(conversation_id, message),
                env=self._build_env(),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            self._active[run_id] = process
            yield StreamEvent("status", {"status": "thinking", "label": "OpenClaw думает..."})

            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=max(5, self.config.openclaw_timeout_seconds + 5),
            )
            output = stdout.decode("utf-8", errors="replace").strip()
            error_output = stderr.decode("utf-8", errors="replace").strip()

            if process.returncode != 0:
                message_text = self._safe_error(error_output or output or "OpenClaw call failed")
                self._maybe_open_circuit(message_text)
                raise AgentProviderError(message_text)

            response = self._extract_response_text(output)
            yield StreamEvent("status", {"status": "responding", "label": "OpenClaw отвечает..."})
            for token in response.split(" "):
                await asyncio.sleep(0.01)
                yield StreamEvent("token", {"text": token + " "})
            yield StreamEvent("status", {"status": "done", "label": "Готово"})
        except asyncio.TimeoutError as exc:
            if process and process.returncode is None:
                process.terminate()
                await process.wait()
            raise AgentProviderError("OpenClaw timed out") from exc
        except asyncio.CancelledError:
            if process and process.returncode is None:
                process.terminate()
                await process.wait()
            raise
        finally:
            self._active.pop(run_id, None)

    async def stop_generation(self, run_id: str) -> None:
        process = self._active.get(run_id)
        if process and process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=3)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()

    async def get_available_models(self) -> list[dict]:
        model = self.config.openclaw_model or "default"
        return [{"id": model, "name": f"OpenClaw {model}", "provider": "openclaw"}]

    async def get_available_tools(self) -> list[dict]:
        return [{"id": "openclaw-agent", "name": "OpenClaw Agent", "safe": False}]

    def _build_command(self, conversation_id: str, message: str) -> list[str]:
        command = [
            self.config.openclaw_command,
            "agent",
            "--json",
            "--agent",
            self.config.openclaw_agent_id,
            "--session-key",
            f"agent:{self.config.openclaw_agent_id}:dymok-web-{conversation_id}",
            "--message",
            message,
            "--timeout",
            str(self.config.openclaw_timeout_seconds),
        ]
        if self.config.openclaw_model:
            command.extend(["--model", self.config.openclaw_model])
        return command

    def _build_env(self) -> dict[str, str]:
        env = os.environ.copy()
        prefixes = [item for item in self.config.openclaw_path_prefix.split(":") if item]
        node_path = shutil.which("node")
        if node_path:
            prefixes.append(os.path.dirname(node_path))
        prefixes.append("/opt/homebrew/bin")
        prefixes.append("/usr/local/bin")
        if prefixes:
            env["PATH"] = ":".join(dict.fromkeys(prefixes + [env.get("PATH", "")]))
        return env

    def _extract_response_text(self, output: str) -> str:
        if not output:
            raise AgentProviderError("OpenClaw returned an empty response")
        try:
            payload = json.loads(output)
        except json.JSONDecodeError:
            return output

        text = self._find_text(payload)
        if text:
            return text
        return json.dumps(payload, ensure_ascii=False, indent=2)

    def _find_text(self, value) -> str | None:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            for key in ("reply", "content", "message", "text", "result", "output"):
                found = self._find_text(value.get(key))
                if found:
                    return found
            for item in value.values():
                found = self._find_text(item)
                if found:
                    return found
        if isinstance(value, list):
            parts = [found for item in value if (found := self._find_text(item))]
            if parts:
                return "\n".join(parts)
        return None

    def _maybe_open_circuit(self, text: str) -> None:
        if any(marker in text.lower() for marker in self.quota_markers):
            self._circuit_open_until = time.time() + self.config.openclaw_circuit_breaker_seconds
            raise AgentProviderQuotaError(text)

    def _safe_error(self, text: str) -> str:
        return text.replace(self.config.openclaw_api_key, "[redacted]") if self.config.openclaw_api_key else text


class OpenClawGatewayProvider(OpenClawCliProvider):
    async def stream_message(self, conversation_id: str, message: str, run_id: str) -> AsyncIterator[StreamEvent]:
        yield StreamEvent("run", {"run_id": run_id, "provider": "openclaw_gateway"})
        yield StreamEvent("status", {"status": "connecting", "label": "Подключение к OpenClaw Gateway..."})

        if self._circuit_open_until > time.time():
            seconds_left = int(self._circuit_open_until - time.time())
            raise AgentProviderQuotaError(f"OpenClaw circuit breaker is active for {seconds_left}s")

        process: Process | None = None
        try:
            process = await asyncio.create_subprocess_exec(
                "node",
                str(Path(__file__).with_name("openclaw_gateway_bridge.mjs")),
                env=self._build_env(),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            self._active[run_id] = process
            payload = {
                "runId": run_id,
                "sessionKey": f"agent:{self.config.openclaw_agent_id}:dymok-web-{conversation_id}",
                "agentId": self.config.openclaw_agent_id,
                "message": message,
                "model": self.config.openclaw_model or None,
                "timeoutMs": self.config.openclaw_timeout_seconds * 1000,
            }
            assert process.stdin is not None
            process.stdin.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
            await process.stdin.drain()
            process.stdin.close()

            assert process.stdout is not None
            while True:
                line = await asyncio.wait_for(
                    process.stdout.readline(),
                    timeout=max(5, self.config.openclaw_timeout_seconds + 10),
                )
                if not line:
                    break
                event = self._parse_bridge_event(line.decode("utf-8", errors="replace"))
                if event.event == "error":
                    message_text = self._safe_error(str(event.data.get("message") or "OpenClaw Gateway error"))
                    self._maybe_open_circuit(message_text)
                    raise AgentProviderError(message_text)
                yield event

            return_code = await process.wait()
            if return_code != 0:
                stderr = ""
                if process.stderr is not None:
                    stderr = (await process.stderr.read()).decode("utf-8", errors="replace").strip()
                message_text = self._safe_error(stderr or f"OpenClaw Gateway bridge exited with {return_code}")
                self._maybe_open_circuit(message_text)
                raise AgentProviderError(message_text)
        except asyncio.TimeoutError as exc:
            if process and process.returncode is None:
                process.terminate()
                await process.wait()
            raise AgentProviderError("OpenClaw Gateway timed out") from exc
        except asyncio.CancelledError:
            if process and process.returncode is None:
                process.terminate()
                await process.wait()
            raise
        finally:
            self._active.pop(run_id, None)

    def _parse_bridge_event(self, line: str) -> StreamEvent:
        try:
            payload = json.loads(line)
        except json.JSONDecodeError as exc:
            raise AgentProviderError("Invalid OpenClaw Gateway bridge event") from exc
        event = payload.get("event")
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        if not isinstance(event, str) or not event:
            raise AgentProviderError("Invalid OpenClaw Gateway bridge event")
        if event == "tool":
            return StreamEvent(
                "status",
                {
                    "status": data.get("phase") or data.get("status") or "tool",
                    "label": f"Инструмент: {data.get('name') or 'OpenClaw'}",
                },
            )
        if event == "status":
            label_map = {
                "connected": "OpenClaw подключён",
                "final": "Готово",
                "done": "Готово",
                "error": "Ошибка",
                "aborted": "Остановлено",
            }
            status = str(data.get("status") or "")
            if status in label_map:
                data["label"] = label_map[status]
        return StreamEvent(event, data)


def create_provider(config: Settings = settings) -> AgentProvider:
    if config.agent_provider == "openclaw_gateway":
        return OpenClawGatewayProvider(config)
    if config.agent_provider == "openclaw_cli":
        return OpenClawCliProvider(config)
    return MockOpenClawProvider()
