FROM golang:1.23 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o tenant-billing .

FROM gcr.io/distroless/static-debian12
COPY --from=builder /app/tenant-billing /tenant-billing
EXPOSE 8257
CMD ["/tenant-billing"]
