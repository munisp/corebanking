FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o service .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/service /service
EXPOSE 8080
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8080/healthz || exit 1
CMD ["/service"]
