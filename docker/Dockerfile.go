# Multi-stage Dockerfile for Go microservices
# Usage: docker build -f docker/Dockerfile.go --build-arg SERVICE=teller-operations-go -t 54bank/teller .

ARG SERVICE
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY services/${SERVICE}/go.mod services/${SERVICE}/go.sum* ./
RUN go mod download 2>/dev/null || true
COPY services/${SERVICE}/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /service .

FROM alpine:3.19
RUN adduser -D -u 1001 appuser
COPY --from=builder /service /service
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:${PORT:-8090}/healthz || exit 1
USER appuser
ENTRYPOINT ["/service"]
