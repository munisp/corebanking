FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o erpnext-bridge .
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/erpnext-bridge .
EXPOSE 8110
CMD ["./erpnext-bridge"]
