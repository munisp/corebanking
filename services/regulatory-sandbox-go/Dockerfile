FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o regulatory-sandbox .
FROM alpine:3.19
COPY --from=builder /app/regulatory-sandbox /usr/local/bin/
CMD ["regulatory-sandbox"]
