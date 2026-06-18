FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o service .

FROM alpine:3.19
RUN adduser -D -u 1001 appuser
COPY --from=builder /app/service /usr/local/bin/service
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8572/healthz || exit 1
EXPOSE 8572
CMD ["service"]
