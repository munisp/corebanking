FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o kafka-schema-registry .
FROM alpine:3.19
COPY --from=builder /app/kafka-schema-registry /usr/local/bin/
CMD ["kafka-schema-registry"]
