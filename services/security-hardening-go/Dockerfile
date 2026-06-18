FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /security-hardening .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
COPY --from=builder /security-hardening /security-hardening
ENTRYPOINT ["/security-hardening"]
