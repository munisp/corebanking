FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o e2e-orchestrator .
FROM alpine:3.19
COPY --from=builder /app/e2e-orchestrator /usr/local/bin/
CMD ["e2e-orchestrator"]
