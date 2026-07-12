FROM golang:1.23-alpine AS builder

RUN apk add --no-cache ca-certificates git

WORKDIR /app

# FIX: only copy go.mod (no go.sum in your repo)
COPY go.mod ./

RUN go mod download || true

COPY . .

RUN go mod tidy

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /service .

FROM alpine:3.19

RUN apk add --no-cache ca-certificates && adduser -D appuser

USER appuser
WORKDIR /app

COPY --from=builder /service /service

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:${PORT}/healthz || exit 1

CMD ["/service"]