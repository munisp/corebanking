FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o service .

FROM alpine:3.19
RUN adduser -D appuser
WORKDIR /app
COPY --from=builder /app/service .
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:${PORT:-8192}/healthz || exit 1
ENTRYPOINT ["./service"]
