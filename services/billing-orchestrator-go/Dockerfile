FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY main.go .
RUN go build -o service main.go

FROM alpine:3.19
COPY --from=builder /app/service /service
EXPOSE 8242
CMD ["/service"]
