# Dymok Web Development Plan

Date: 2026-09-07

## Existing Environment

- Workspace already contains OpenClaw/Dymok operational files, but no `frontend/` or `backend/` web project yet.
- Node: v26.3.0, npm: 11.16.0, pnpm: 11.5.1.
- Python: 3.9.6, uv: 0.11.21.
- Local Dymok launchd jobs are disabled.
- VPS OpenClaw cron was removed during token-leak cleanup; no hidden scheduled OpenClaw jobs should be created by this project.

## Existing Solutions Preflight

Checked common self-hosted AI UIs before custom implementation:

- LibreChat: mature self-hosted multi-provider AI chat.
- Open WebUI: feature-rich self-hosted chat UI, especially for OpenAI-compatible APIs/Ollama.
- LobeChat: polished open-source AI chat framework.

Decision: build custom because Slava's requirements need a Dymok-specific UI, a strict FastAPI AgentProvider boundary, backend-enforced autonomy/permission model, and explicit protections against background token leaks.

## Streaming Choice

Use Server-Sent Events for Stage 1.

Reasons:

- chat completion streaming is one-way from backend to browser;
- simpler than WebSocket for first MVP;
- easy to proxy through Nginx later;
- easier cancellation can be handled by separate stop endpoint;
- no persistent bidirectional socket that could accidentally turn into background polling.

WebSocket can be added later only if agent activity needs bidirectional real-time control.

## Stage Dependencies

Stage 1 must exist before everything else:

- database tables for users, conversations, messages;
- API shape;
- UI layout and chat flow;
- AgentProvider abstraction;
- mock streaming and stop behavior.

Stage 2 depends on Stage 1 AgentProvider and streaming API.

Stage 3 depends on Stage 1 database/service boundaries and Stage 2 provider errors/cancellation model.

Stage 4 depends on Stage 1 UI structure and Stage 3 activity/task model.

Stage 5 depends on all previous stages.

Production deployment depends on Stage 5 verification and server inspection.

## Stage 1 Deliverables

- `frontend/` React + TypeScript + Vite + Tailwind.
- `backend/` FastAPI + SQLAlchemy + SQLite.
- Mock `AgentProvider` and `OpenClawProvider` placeholder.
- SSE streaming mock responses.
- Persistent conversations and messages.
- Responsive app shell: sidebar, chat, empty state, composer.
- Dark/light/system theme.
- No background AI/OpenClaw calls.
- README and `.env.example` starter docs.

## Stage 1 Verification

- backend imports and starts;
- `GET /api/health`;
- create conversation through API;
- stream message through API;
- persisted messages can be read back;
- frontend typecheck/build/lint where configured;
- local browser check on desktop and mobile viewport.
