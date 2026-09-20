# PL-04: builder bumped 1.21 → 1.22 — go.mod requires go 1.22.7 (shared/otel/go
# baseline); the 1.21 builder could never have compiled this module.
FROM golang:1.22-alpine AS builder
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
