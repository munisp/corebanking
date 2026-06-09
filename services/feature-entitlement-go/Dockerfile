FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY main.go .
RUN go build -o entitlement-engine .

FROM alpine:3.19
COPY --from=builder /app/entitlement-engine /usr/local/bin/
EXPOSE 8107
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8107/healthz || exit 1
CMD ["entitlement-engine"]
