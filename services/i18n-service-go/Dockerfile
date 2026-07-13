FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o i18n-service .
FROM alpine:3.19
COPY --from=builder /app/i18n-service /usr/local/bin/
CMD ["i18n-service"]
