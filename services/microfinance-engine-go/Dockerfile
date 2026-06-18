FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /microfinance-engine-go .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
COPY --from=builder /microfinance-engine-go /microfinance-engine-go
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:9390/healthz || exit 1
ENTRYPOINT ["/microfinance-engine-go"]
