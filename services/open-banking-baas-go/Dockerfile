FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -o open-banking-baas .

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/open-banking-baas .
EXPOSE 8102
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8102/healthz || exit 1
CMD ["./open-banking-baas"]
