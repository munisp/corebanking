# B5 P1-C: was `FROM python:3.12-slim ... ENTRYPOINT ["python", "migrate.py"]`
# — migrate.py never existed, so the image could not start. Rebuilt as the
# real Go runner image (pattern: services/gl-engine-go/Dockerfile).
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# migrations/ is embedded via go:embed in migrate.go — no runtime mount needed
# (MIGRATIONS_DIR can still point at a volume to override).
RUN CGO_ENABLED=0 go build -o db-migrations .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/db-migrations /usr/local/bin/
EXPOSE 9345
# Fleet env conventions (docker-compose.consolidated.yml:19-32): DATABASE_URL
# (or DATABASE_URI, or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD[/DB_SSLMODE]).
# Set MIGRATIONS_EXIT_AFTER_RUN=true for k8s Job / initContainer usage.
CMD ["db-migrations"]
