FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o nibss-nip-engine .
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/nibss-nip-engine .
EXPOSE 8111
CMD ["./nibss-nip-engine"]
