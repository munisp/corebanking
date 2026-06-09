FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /security-gateway .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /security-gateway /security-gateway
EXPOSE 8105
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8105/healthz || exit 1
CMD ["/security-gateway"]
