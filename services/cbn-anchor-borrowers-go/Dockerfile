FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o service .

FROM alpine:3.19
RUN adduser -D appuser
USER appuser
WORKDIR /app
COPY --from=builder /app/service .
ENV PORT=8593
EXPOSE 8593
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8593/healthz || exit 1
CMD ["./service"]
