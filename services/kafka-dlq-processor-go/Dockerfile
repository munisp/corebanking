FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY main.go .
RUN go build -o /kafka-dlq-processor-go main.go

FROM alpine:3.19
COPY --from=builder /kafka-dlq-processor-go /kafka-dlq-processor-go
USER 1000:1000
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8080/healthz || exit 1
CMD ["/kafka-dlq-processor-go"]
