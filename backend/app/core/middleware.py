import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        return response


class ChatRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.requests: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.url.path != "/api/chat/stream" or settings.chat_rate_limit_per_minute <= 0:
            return await call_next(request)

        now = time.monotonic()
        window_start = now - 60
        key = request.client.host if request.client else "unknown"
        entries = self.requests[key]
        while entries and entries[0] < window_start:
            entries.popleft()
        if len(entries) >= settings.chat_rate_limit_per_minute:
            return Response(
                content='{"detail":"Chat rate limit exceeded"}',
                media_type="application/json",
                status_code=429,
            )
        entries.append(now)
        return await call_next(request)
