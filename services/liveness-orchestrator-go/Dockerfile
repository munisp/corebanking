FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download 2>/dev/null || true
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o server .

FROM alpine:3.19
RUN adduser -D appuser
WORKDIR /app
COPY --from=builder /app/server .
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:${PORT:-8231}/healthz || exit 1
ENTRYPOINT ["./server"]
