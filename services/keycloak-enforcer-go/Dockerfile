FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -o keycloak-enforcer-go .
FROM alpine:3.19
COPY --from=builder /app/keycloak-enforcer-go /usr/local/bin/
EXPOSE 8278
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8278/healthz || exit 1
CMD ["keycloak-enforcer-go"]
