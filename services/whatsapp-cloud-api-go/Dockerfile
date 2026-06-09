FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o whatsapp-cloud-api .
FROM alpine:3.19
COPY --from=builder /app/whatsapp-cloud-api .
EXPOSE 8115
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8115/healthz || exit 1
CMD ["./whatsapp-cloud-api"]
