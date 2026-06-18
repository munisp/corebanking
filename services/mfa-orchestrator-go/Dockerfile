FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY *.go ./
RUN go build -o service .
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/service .
EXPOSE 8489
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8489/healthz || exit 1
CMD ["./service"]
