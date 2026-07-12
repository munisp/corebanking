FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o trade-finance .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates wget
COPY --from=builder /app/trade-finance /usr/local/bin/trade-finance
ENV ADDR=0.0.0.0:8093
EXPOSE 8093
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8093/healthz >/dev/null || exit 1
CMD ["trade-finance"]
