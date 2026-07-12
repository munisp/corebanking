FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -o growth-features .

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/growth-features .
EXPOSE 8105
CMD ["./growth-features"]
