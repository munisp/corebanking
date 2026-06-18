FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -o apisix-gateway-go .
FROM alpine:3.19
COPY --from=builder /app/apisix-gateway-go /usr/local/bin/
EXPOSE 8275
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8275/healthz || exit 1
CMD ["apisix-gateway-go"]
