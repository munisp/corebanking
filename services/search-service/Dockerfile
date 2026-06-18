FROM golang:1.25-alpine AS builder
WORKDIR /app
RUN apk add --no-cache bash
COPY go.mod go.sum* ./
RUN for i in 1 2 3; do go mod download && break || sleep 10; done
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /search .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /search .
EXPOSE 8080
CMD ["./search"]
