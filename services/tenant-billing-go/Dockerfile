FROM golang:1.23 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o tenant-billing .

FROM gcr.io/distroless/static-debian12
COPY --from=builder /app/tenant-billing /tenant-billing
EXPOSE 8257
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8257/healthz || exit 1
CMD ["/tenant-billing"]
