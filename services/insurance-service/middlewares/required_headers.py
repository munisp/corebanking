from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RequiredHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        required_headers: list[str],
        exclude_paths: list[str] | None = None,
        exclude_prefixes: list[str] | None = None,
        include_prefixes: list[str] | None = None,
    ):
        super().__init__(app)

        # Validate mutual exclusivity
        if exclude_prefixes and include_prefixes:
            raise ValueError(
                "exclude_prefixes and include_prefixes cannot be used together."
            )

        self.required_headers = [h.lower() for h in required_headers]
        self.exclude_paths = exclude_paths or []
        self.exclude_prefixes = exclude_prefixes or []
        self.include_prefixes = include_prefixes or []

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # 1. Exact path exclusions
        if path in self.exclude_paths:
            return await call_next(request)

        # 2. Prefix-based exclusions
        for prefix in self.exclude_prefixes:
            if path.startswith(prefix):
                return await call_next(request)

        # 3. Prefix-based inclusions (if set)
        if self.include_prefixes:
            should_validate = any(path.startswith(prefix) for prefix in self.include_prefixes)
            if not should_validate:
                # Path not included → skip validation
                return await call_next(request)

        # 4. Required header validation
        missing_headers = [
            header for header in self.required_headers
            if header not in request.headers
        ]

        if missing_headers:
            return JSONResponse(
                status_code=400,
                content={
                    "error": "Missing required headers",
                    "missing": missing_headers,
                },
            )

        return await call_next(request)
