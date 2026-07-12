FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /swift-messaging-go .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
COPY --from=builder /swift-messaging-go /swift-messaging-go
ENTRYPOINT ["/swift-messaging-go"]
