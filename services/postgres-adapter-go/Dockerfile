FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY main.go .
RUN CGO_ENABLED=0 go build -o /service main.go

FROM alpine:3.19
COPY --from=builder /service /service
EXPOSE 8200
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8200/healthz || exit 1
CMD ["/service"]
