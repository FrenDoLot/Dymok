# Дымок Web

Персональный веб-интерфейс ИИ-агента Дымок на базе OpenClaw.

**Рабочая версия:** [dymok.193.124.91.112.sslip.io](https://dymok.193.124.91.112.sslip.io/)

## Technology Stack

- Languages: TypeScript, TSX, Python, JavaScript, HTML, CSS, SQL, Shell;
- Frontend: React 19, Vite, Tailwind CSS, Zustand, Lucide, Markdown rendering;
- Backend: FastAPI, Uvicorn, Pydantic, SQLAlchemy, SQLite;
- AI runtime: OpenClaw CLI and OpenClaw Gateway;
- Testing: Playwright, TypeScript compiler, Oxlint;
- Infrastructure: Docker, Docker Compose, Nginx, systemd, Let's Encrypt;
- Environments: Node.js/npm, Python virtual environments, Linux VPS, macOS development.

## Architecture

Browser -> React UI -> FastAPI -> Agent Service -> AgentProvider -> OpenClaw.

Frontend never receives OpenClaw credentials and never calls OpenClaw directly.
The backend owns provider configuration, stop handling, quota/cooldown handling,
and future permission checks.

## Current Stage

Stage 1 MVP is complete:

- React, TypeScript, Vite, Tailwind CSS;
- FastAPI, SQLAlchemy, SQLite;
- conversations and messages;
- responsive sidebar and mobile drawer;
- textarea composer with Enter/Shift+Enter behavior;
- Markdown rendering with code blocks and tables;
- mock SSE streaming;
- dark/light/system theme state;
- Playwright smoke tests.

Stage 2 OpenClaw integration is complete for the current local target:

- `AgentProvider` can be switched with `AGENT_PROVIDER`;
- `mock` is the default and makes no OpenClaw calls;
- `openclaw_cli` performs one explicit user-triggered `openclaw agent` call per chat message;
- `openclaw_gateway` connects to OpenClaw Gateway and relays live `chat.send` events;
- quota/rate-limit/cooldown errors open a backend circuit breaker;
- `Stop` calls the backend `/api/chat/stop` endpoint.

Stage 3 agent system is complete as a working permission/approval foundation:

- tasks, agent runs, tool calls, approvals, permission rules, user settings, and audit log tables;
- `/api/tasks`, `/api/agent-runs`, `/api/tool-calls`, `/api/approvals`, `/api/permissions`, and `/api/audit`;
- chat-only, ask-before-actions, and autonomous mode state;
- backend permission decisions for action categories;
- approval cards in chat and Settings activity views;
- emergency stop path through the backend.

Stage 4 files, mobile, and PWA foundation is complete:

- attachment model and upload storage;
- `/api/attachments` upload/list API;
- composer file picker and drag/drop attach;
- clipboard image/file paste;
- message attachment chips;
- Files navigation view;
- Notification Center and push-subscription API;
- PWA manifest, conservative service worker shell cache, and push event handlers.

Stage 5 security and production foundation has started:

- FastAPI security headers;
- chat stream rate limit;
- Dockerfiles for backend/frontend;
- Nginx production config for frontend/API proxy;
- `docker-compose.yml` with persistent data volume and backend healthcheck;
- Docker build and compose smoke verified locally on `http://127.0.0.1:8080`;
- production security checklist in `docs/production-security-checklist.md`.

## Streaming Choice

Stage 1 uses Server-Sent Events. Chat output is one-way from backend to browser,
SSE is simple to proxy through Nginx, and it avoids persistent bidirectional
sockets that could encourage accidental background polling. Gateway WebSocket
integration is available through the `openclaw_gateway` provider and can become
the production default once Gateway runs with a narrow web-app profile.

## Development

Backend:

```bash
cd backend
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open the app at `http://127.0.0.1:5173`.

## Environment

Copy `backend/.env.example` for backend configuration. Important values:

- `DATABASE_URL`: SQLite now, PostgreSQL-compatible boundary later.
- `AGENT_PROVIDER`: `mock`, `openclaw_cli`, or `openclaw_gateway`.
- `OPENCLAW_COMMAND`: path/name of the OpenClaw CLI.
- `OPENCLAW_GATEWAY_URL`: Gateway WebSocket URL for `openclaw_gateway`.
- `OPENCLAW_GATEWAY_CLIENT_MODULE`: local OpenClaw Gateway client module path.
- `OPENCLAW_AGENT_ID`: OpenClaw agent id, default `main`.
- `OPENCLAW_MODEL`: optional model override.
- `OPENCLAW_TIMEOUT_SECONDS`: per-turn timeout.
- `OPENCLAW_CIRCUIT_BREAKER_SECONDS`: backoff after quota/rate-limit failures.
- `CHAT_RATE_LIMIT_PER_MINUTE`: per-process chat stream limit.
- `UPLOAD_DIR`: backend-only directory for uploaded files.
- `MAX_UPLOAD_BYTES`: per-file upload limit.
- `ALLOWED_UPLOAD_EXTENSIONS`: comma-separated upload extension allowlist.
- `OPENCLAW_API_KEY`: server-side only; never expose to frontend.

## Verification

```bash
cd frontend
npm run build
npm run lint
npm run test:e2e -- --reporter=line
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npm run test:e2e -- --reporter=line

cd ../backend
.venv/bin/python -m compileall app
```

The e2e test expects backend on `127.0.0.1:8000` and frontend on `127.0.0.1:5173`.

## Production

The public HTTPS deployment is available at
`https://dymok.193.124.91.112.sslip.io/`. Ongoing production hardening includes:

- a narrowly scoped OpenClaw Gateway runtime profile;
- stronger user authentication and access control;
- periodic secrets and dependency reviews;
- target-host smoke tests after deployments.
