FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o event-sourcing .
FROM alpine:3.19
COPY --from=builder /app/event-sourcing /usr/local/bin/
CMD ["event-sourcing"]
