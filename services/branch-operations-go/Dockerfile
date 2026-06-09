FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /branch-operations-go .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
COPY --from=builder /branch-operations-go /branch-operations-go
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:9325/healthz || exit 1
ENTRYPOINT ["/branch-operations-go"]
