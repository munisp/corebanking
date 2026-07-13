FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o gl-engine-go .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/gl-engine-go /usr/local/bin/
EXPOSE 8090
CMD ["gl-engine-go"]
