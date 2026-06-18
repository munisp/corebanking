FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o i18n-service .
FROM alpine:3.19
COPY --from=builder /app/i18n-service /usr/local/bin/
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:9368/healthz || exit 1
CMD ["i18n-service"]
