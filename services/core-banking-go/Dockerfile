FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o service .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/service /service
EXPOSE 8080
CMD ["/service"]
