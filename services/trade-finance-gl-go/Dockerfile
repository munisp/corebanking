FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o trade-finance-gl .

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/trade-finance-gl .
EXPOSE 8098
CMD ["./trade-finance-gl"]
