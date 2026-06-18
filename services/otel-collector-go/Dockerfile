FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o otel-collector .
FROM alpine:3.19
COPY --from=builder /app/otel-collector /usr/local/bin/
CMD ["otel-collector"]
