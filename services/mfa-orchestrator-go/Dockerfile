FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY *.go ./
RUN go build -o service .
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/service .
EXPOSE 8489
CMD ["./service"]
