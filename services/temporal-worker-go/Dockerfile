FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY *.go ./
RUN CGO_ENABLED=0 go build -o service .

FROM alpine:3.19
RUN adduser -D -s /bin/sh appuser
COPY --from=builder /app/service /usr/local/bin/service
USER appuser
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:${PORT:-8080}/healthz || exit 1
ENTRYPOINT ["/usr/local/bin/service"]
