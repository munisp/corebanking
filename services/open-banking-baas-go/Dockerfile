FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -o open-banking-baas .

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/open-banking-baas .
EXPOSE 8102
CMD ["./open-banking-baas"]
