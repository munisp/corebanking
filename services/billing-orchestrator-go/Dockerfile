FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY main.go .
RUN go build -o service main.go

FROM alpine:3.19
COPY --from=builder /app/service /service
EXPOSE 8242
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8242/healthz || exit 1
CMD ["/service"]
