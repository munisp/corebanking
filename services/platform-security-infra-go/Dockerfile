FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o platform-security-infra .

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/platform-security-infra .
EXPOSE 8101
CMD ["./platform-security-infra"]
