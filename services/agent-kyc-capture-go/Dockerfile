FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod main.go ./
RUN go build -o service .
FROM alpine:3.19
COPY --from=builder /app/service /usr/local/bin/
CMD ["service"]
