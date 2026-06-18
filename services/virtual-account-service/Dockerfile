FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download 2>/dev/null || go mod init virtual-account-service
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /virtual-account .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /virtual-account .
EXPOSE 8080
CMD ["./virtual-account"]
