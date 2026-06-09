FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o mojaloop-settlement-mgr-go .
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/mojaloop-settlement-mgr-go /usr/local/bin/
EXPOSE 8268
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8268/healthz || exit 1
CMD ["mojaloop-settlement-mgr-go"]
