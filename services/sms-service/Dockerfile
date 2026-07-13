# Multi-stage build for SMS Banking Service
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install build dependencies including librdkafka for confluent-kafka-go
RUN apk add --no-cache git ca-certificates gcc musl-dev pkgconf librdkafka-dev

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download || true

# Copy source code
COPY . .
RUN go get github.com/gorilla/mux@v1.8.1 github.com/prometheus/client_golang/prometheus/promhttp@latest && go mod tidy

# Build the application with CGO enabled and dynamic librdkafka
RUN CGO_ENABLED=1 GOOS=linux go build -tags dynamic -o sms-service .

# Final stage
FROM alpine:3.19

WORKDIR /app

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata librdkafka

# Copy binary from builder
COPY --from=builder /app/sms-service .

# Create non-root user
RUN adduser -D -g '' appuser
USER appuser

# Expose port
EXPOSE 8104

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8104/health || exit 1

# Run the application
CMD ["./sms-service"]
