FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o interest-accrual-engine .

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/interest-accrual-engine .
EXPOSE 8093
CMD ["./interest-accrual-engine"]
