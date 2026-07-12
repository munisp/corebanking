FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o debt-collection .
FROM alpine:3.19
COPY --from=builder /app/debt-collection /usr/local/bin/
CMD ["debt-collection"]
