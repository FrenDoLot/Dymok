# Dymok Web Interface Requirements

Date: 2026-09-07
Owner: Slava
Project: Dymok personal AI agent web interface

This document is the project requirements source distilled from Slava's full specification in the 2026-09-07 chat. If implementation details conflict, prefer the architectural and safety constraints here over convenience.

## Product Goal

Build a modern full-stack responsive web interface for the personal AI agent "Дымок".

The interface must work on desktop, tablet, and mobile browsers, and later be PWA-installable. It should feel minimal, calm, modern, and distinct from ChatGPT/Claude/Open WebUI while learning from their ergonomics.

## Architecture

Frontend must never depend directly on OpenClaw.

Required boundary:

Browser -> React UI -> FastAPI -> Agent Service -> AgentProvider -> OpenClaw -> AI models/tools/integrations

OpenClaw must be replaceable without rewriting the frontend.

OpenClaw configuration and secrets are backend-only:

- `OPENCLAW_API_URL`
- `OPENCLAW_API_KEY`

Never expose OpenClaw API keys to the frontend.

## Technology Choices

Frontend:

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui preferred where practical
- Zustand or similarly small state management

Backend:

- Python
- FastAPI
- SQLAlchemy
- SQLite first, PostgreSQL-ready architecture

Streaming:

- SSE or WebSocket
- The chosen transport must be documented.

Project layout:

- `frontend/`
- `backend/`

## MVP Scope: Stage 1 Only

Do not implement the full system in one pass. Stage 1 must end in a working, tested state.

Stage 1 includes:

- React + TypeScript + Vite
- FastAPI backend
- SQLite database
- responsive layout
- desktop sidebar and mobile drawer-ready structure
- New Chat
- Conversations list
- Messages
- multiline textarea
- Enter sends, Shift+Enter inserts newline
- mock AI response
- streaming mock response
- persisted history
- dark/light/system appearance
- basic loading/error/empty states
- AgentProvider abstraction
- mock OpenClawProvider
- no hidden background AI/OpenClaw calls

Stage 1 must be verified by:

- frontend install/build/typecheck/lint where available
- backend install/import/start
- database initialization
- create conversation
- send message
- receive streaming response
- reload and confirm history persistence
- responsive UI check

## Later Stages

Stage 2: real OpenClaw integration.

- Browser -> FastAPI -> OpenClaw -> streamed response -> Browser
- handle disconnects, timeouts, OpenClaw unavailable, quota errors, cancellation
- no background agent calls

Stage 3: agent system.

- ToolCall
- AgentActivity / ToolCallCard
- Tasks
- AgentRuns
- Chat only / Ask before actions / Autonomous modes
- Permission Matrix
- Approvals
- Emergency Stop
- Audit Log
- tests for all autonomy modes

Stage 4: files, mobile, PWA.

- file upload and attachment cards
- PNG/JPEG/WebP/PDF/TXT/Markdown/CSV/JSON/code/documents
- drag and drop
- clipboard image paste
- mobile/tablet optimization
- PWA manifest/service worker/icons
- Notification Center and push-ready architecture

Stage 5: security and production.

- security review
- secrets review
- permission review
- autonomous mode review
- agent-loop and rate-limit protections
- production build
- Docker build

Production deployment:

- inspect server first
- do not break existing services
- HTTPS through Nginx preferred
- persistent database
- healthchecks and restart policy
- final verification before declaring complete

## Core UI Requirements

Main screen: chat with Dymok.

Desktop:

- left sidebar
- centered chat area

Sidebar:

- Dymok logo/symbol
- "Дымок"
- New Chat
- search
- conversation history
- pinned conversations
- navigation: Chats, Tasks, Files, Settings
- collapsible sidebar

Conversation actions:

- rename
- delete
- pin/unpin

Empty conversation:

- "Чем займёмся?"
- quick actions:
  - "Найди информацию"
  - "Помоги с кодом"
  - "Создай задачу"
  - "Проанализируй файл"

Chat messages:

- user messages
- Dymok messages
- Markdown
- code blocks
- syntax highlighting
- tables
- lists
- links
- images and attachments later
- Copy, Retry, Stop generation

Composer:

- multiline input
- Enter sends
- Shift+Enter newline
- Send button
- Stop button
- file attach and drag/drop later
- clipboard images later
- mobile keyboard and safe-area aware

## Streaming and Activity

Responses must appear progressively.

Visible states:

- Connecting
- Дымок думает...
- Tool running
- Waiting for result
- Done
- Error

Do not show chain-of-thought. Only safe operational statuses.

Stage 3 must add AgentActivity / ToolCallCard with:

- tool name
- status
- short description
- elapsed time
- expandable technical details

## Data Model Targets

User:

- id
- username
- email
- password_hash / external_auth_id
- created_at

Conversation:

- id
- user_id
- title
- created_at
- updated_at
- is_pinned

Message:

- id
- conversation_id
- role
- content
- created_at
- metadata

ToolCall:

- id
- message_id
- agent_run_id
- tool_name
- status
- input
- result
- started_at
- completed_at

Task:

- id
- user_id
- title
- description
- status: pending/running/waiting_for_user/completed/failed/cancelled
- created_at
- updated_at
- result

AgentRun:

- id
- user_id
- conversation_id
- task_id
- status: queued/planning/running/waiting_for_approval/completed/failed/cancelled
- autonomy_mode
- started_at
- completed_at
- current_step
- result
- error

Audit Log:

- timestamp
- AgentRun
- ToolCall
- tool/action
- autonomy mode
- permission decision
- approval requirement
- result
- error

Never store secrets in ToolCall or Audit Log.

## Autonomy and Permissions

Modes:

- Chat only: answer/analyze/propose; no external actions.
- Ask before actions: safe internal operations allowed, significant external actions require approval.
- Autonomous: only pre-approved categories may run without asking.

Permission Matrix values:

- ALLOW
- ASK
- DENY

Permission checks must run on backend. Frontend is not a security boundary.

Approval API:

- approve
- reject
- linked to AgentRun and ToolCall

Emergency Stop:

- user can stop AgentRun immediately
- stopped AgentRun must not start new actions

## Security Requirements

- API keys and secrets backend-only
- CORS configured
- CSRF considered where applicable
- rate limiting
- Markdown sanitization and XSS protection
- safe file upload validation
- path traversal protection
- request size limits
- safe SSE/WebSocket handling
- logs must not contain secrets
- no public admin/autonomous controls without authentication

## Agent Loop and Token Protection

The app must not create hidden background LLM/OpenClaw calls by default.

Forbidden without explicit user-created task:

- polling models every few seconds
- self-tests through LLM
- automatic model-based reindex
- background agent calls
- automatic cron creation

Healthcheck must not spend AI tokens.

Future scheduled AI tasks must be:

- explicit
- visible
- disableable
- logged

On rate limit, usage limit, quota exhausted, or cooldown:

- stop retries
- apply exponential backoff / circuit breaker
- never retry every few seconds

Prevent recursive agent calls:

Agent -> Agent -> Agent -> ...

## API Target

Stage 1 should implement the minimal subset cleanly:

- `GET /api/health`
- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/{id}`
- `DELETE /api/conversations/{id}`
- `GET /api/conversations/{id}/messages`
- `POST /api/conversations/{id}/messages`
- `POST /api/chat/stream`
- `POST /api/chat/stop`
- `GET /api/models`
- `GET /api/tools`

Later stages add files, tasks, agent-runs, approvals, permissions, and audit APIs.

## Documentation and Deployment Targets

Create:

- `README.md`
- `.env.example`
- Docker files
- production deployment notes

Do not deploy until all stages and security checks are complete.

Final report format:

```text
DYMOK — DEPLOYMENT COMPLETE

URL:
<working link>

Frontend: OK / ERROR
Backend: OK / ERROR
OpenClaw: OK / ERROR
Database: OK / ERROR
HTTPS: OK / ERROR
Streaming: OK / ERROR
Autonomy: OK / ERROR
PWA: OK / ERROR
Server project path:
<path>
Containers/services:
<list>
Limitations:
<list>
```
