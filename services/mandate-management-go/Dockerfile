FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
COPY main.go .
RUN CGO_ENABLED=0 go build -o /service main.go

FROM alpine:3.19
COPY --from=builder /service /service
EXPOSE 8221
CMD ["/service"]
