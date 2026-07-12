FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o mojaloop-settlement-mgr-go .
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/mojaloop-settlement-mgr-go /usr/local/bin/
EXPOSE 9394
CMD ["mojaloop-settlement-mgr-go"]
