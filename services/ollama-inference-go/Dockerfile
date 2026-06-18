FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o ollama-inference .
FROM alpine:3.19
COPY --from=builder /app/ollama-inference /usr/local/bin/
CMD ["ollama-inference"]
