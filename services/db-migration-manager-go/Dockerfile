FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o db-migration-manager .
FROM alpine:3.19
COPY --from=builder /app/db-migration-manager /usr/local/bin/
CMD ["db-migration-manager"]
