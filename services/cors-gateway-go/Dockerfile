FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o cors-gateway .
FROM alpine:3.19
COPY --from=builder /app/cors-gateway /usr/local/bin/
CMD ["cors-gateway"]
