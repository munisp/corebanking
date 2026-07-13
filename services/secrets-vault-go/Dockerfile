FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 go build -o service .

FROM alpine:3.19
RUN adduser -D -u 1001 appuser
COPY --from=builder /app/service /service
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8500/healthz || exit 1
EXPOSE 8500
CMD ["/service"]
