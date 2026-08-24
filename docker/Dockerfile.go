# ── Generic multi-stage build for Go services (services/*-go) ───────────────
# Referenced by docker-compose.yml with:
#   build: { context: ., dockerfile: docker/Dockerfile.go, args: { SERVICE: <dir> } }
# Each target service is a self-contained Go module (go.mod + main.go).

# ── Build stage ──────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder
ARG SERVICE
RUN test -n "$SERVICE" || { echo "SERVICE build arg is required"; exit 1; }
WORKDIR /build
COPY services/${SERVICE}/go.mod services/${SERVICE}/go.sum* ./
RUN go mod download
COPY services/${SERVICE}/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/service .

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM alpine:3.19
RUN apk add --no-cache ca-certificates wget && adduser -D -u 10001 appuser
COPY --from=builder /out/service /usr/local/bin/service
USER appuser
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
ENTRYPOINT ["/usr/local/bin/service"]
