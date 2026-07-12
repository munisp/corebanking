FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o helm-validator .
FROM alpine:3.19
COPY --from=builder /app/helm-validator /usr/local/bin/
CMD ["helm-validator"]
