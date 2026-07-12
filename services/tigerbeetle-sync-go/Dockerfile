FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o tigerbeetle-sync-go .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/tigerbeetle-sync-go /usr/local/bin/
EXPOSE 8263
CMD ["tigerbeetle-sync-go"]
