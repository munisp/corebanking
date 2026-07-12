FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o risk-manager-service .

FROM alpine:latest

RUN apk --no-cache add ca-certificates wget

WORKDIR /root/

COPY --from=builder /app/risk-manager-service .

EXPOSE 8129

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8129/health || exit 1

CMD ["./risk-manager-service"]
