FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o keycloak-admin .
FROM alpine:3.19
COPY --from=builder /app/keycloak-admin .
EXPOSE 8117
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8117/healthz || exit 1
CMD ["./keycloak-admin"]
