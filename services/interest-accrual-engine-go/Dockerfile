FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o interest-accrual-engine .

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/interest-accrual-engine .
EXPOSE 8093
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8093/healthz || exit 1
CMD ["./interest-accrual-engine"]
