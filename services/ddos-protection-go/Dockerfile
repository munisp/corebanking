FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /ddos-protection-go .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
COPY --from=builder /ddos-protection-go /ddos-protection-go
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:9346/healthz || exit 1
ENTRYPOINT ["/ddos-protection-go"]
