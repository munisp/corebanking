FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY main.go ./
RUN go build -o service .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/service /usr/local/bin/
CMD ["service"]
