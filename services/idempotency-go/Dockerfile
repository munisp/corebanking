FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o idempotency-go .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/idempotency-go /usr/local/bin/
ENV PORT=8261
EXPOSE 8261
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8261/healthz || exit 1
CMD ["idempotency-go"]
