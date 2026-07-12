FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o api-versioning .
FROM alpine:3.19
COPY --from=builder /app/api-versioning /usr/local/bin/
CMD ["api-versioning"]
