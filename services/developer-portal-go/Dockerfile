FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o developer-portal .
FROM alpine:3.19
COPY --from=builder /app/developer-portal /usr/local/bin/
CMD ["developer-portal"]
