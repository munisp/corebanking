FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /branch-operations-go .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
COPY --from=builder /branch-operations-go /branch-operations-go
ENTRYPOINT ["/branch-operations-go"]
