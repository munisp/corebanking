FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o teller-operations .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates wget
COPY --from=builder /app/teller-operations /usr/local/bin/teller-operations
ENV ADDR=0.0.0.0:8091
EXPOSE 8091
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8091/healthz >/dev/null || exit 1
CMD ["teller-operations"]
