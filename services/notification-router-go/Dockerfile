FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o notification-router .
FROM alpine:3.19
COPY --from=builder /app/notification-router .
EXPOSE 8120
CMD ["./notification-router"]
