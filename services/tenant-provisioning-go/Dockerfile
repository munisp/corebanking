FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY main.go .
RUN CGO_ENABLED=0 go build -o service main.go
FROM alpine:3.19
COPY --from=builder /app/service /service
EXPOSE 8080
CMD ["/service"]
