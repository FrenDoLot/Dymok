# Production Security Checklist

Date: 2026-09-08

## Implemented

- Frontend does not receive OpenClaw credentials.
- Backend owns all AgentProvider configuration.
- `mock` remains the default provider.
- Chat requests are user-triggered through `/api/chat/stream`.
- Backend circuit breaker handles provider quota/rate-limit/cooldown failures.
- Backend permission matrix gates detected action categories.
- Approval decisions are audited.
- Security headers are set by FastAPI and production Nginx.
- Chat stream has a per-process rate limit.
- File uploads use a size limit and extension allowlist.
- Uploaded files are served only through backend attachment ids.
- API requests are not cached by the service worker.

## Required Before Public Deployment

- Run a fresh secrets review on `.env`, shell history, logs, and deployment config.
- Use a narrow OpenClaw Gateway profile without unrelated channels or sidecars.
- Put HTTPS in front of the frontend, preferably Nginx with managed certificates.
- Replace SQLite with a persistent volume at minimum; PostgreSQL before multi-user use.
- Add real authentication before exposing beyond a private network.
- Move rate limiting to Nginx or Redis if running multiple backend workers.
- Add malware/content scanning if accepting arbitrary documents from outside Slava.
- Add a web-push provider and VAPID keys before enabling real push delivery.
- Review autonomous mode rules before enabling it in production.
- Run Docker build and browser smoke tests on the target host before cutover.
