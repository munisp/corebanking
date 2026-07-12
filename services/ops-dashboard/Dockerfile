FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

# Copy source (needed so go mod tidy can resolve all imports)
COPY go.mod go.sum* ./
COPY *.go ./
RUN go mod tidy && go mod download

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Final image
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/main .

EXPOSE 8090

CMD ["./main"]
