FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN CGO_ENABLED=0 go build -o kpi-engine-go .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/kpi-engine-go .
EXPOSE 8500
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8500/healthz || exit 1
CMD ["./kpi-engine-go"]
