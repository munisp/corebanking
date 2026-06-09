FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o identity-verification .
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/identity-verification .
EXPOSE 8114
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8114/healthz || exit 1
CMD ["./identity-verification"]
