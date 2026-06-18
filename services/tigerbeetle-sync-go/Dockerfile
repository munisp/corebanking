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
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8263/healthz || exit 1
CMD ["tigerbeetle-sync-go"]
