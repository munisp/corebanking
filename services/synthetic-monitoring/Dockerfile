FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git bash

# Copy go mod files
COPY go.mod go.sum* ./
RUN for i in 1 2 3; do go mod download && break || sleep 10; done

# Copy source
COPY . .

# Tidy and build
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Final image
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/main .

EXPOSE 8090

CMD ["./main"]
