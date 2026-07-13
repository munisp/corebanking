FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o identity-verification .
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/identity-verification .
EXPOSE 8114
CMD ["./identity-verification"]
