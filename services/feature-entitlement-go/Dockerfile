FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY main.go .
RUN go build -o entitlement-engine .

FROM alpine:3.19
COPY --from=builder /app/entitlement-engine /usr/local/bin/
EXPOSE 8107
CMD ["entitlement-engine"]
