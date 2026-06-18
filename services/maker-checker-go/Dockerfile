FROM golang:1.22-alpine AS builder
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o maker-checker .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/maker-checker /usr/local/bin/
EXPOSE 8210
CMD ["maker-checker"]
