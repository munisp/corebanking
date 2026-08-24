FROM golang:1.23-alpine AS builder
WORKDIR /app
# go.sum is not vendored in this tree; 'go mod download' below resolves and
# records dependency hashes at image build time.
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /gamification main.go

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /gamification .
EXPOSE 8080
CMD ["./gamification"]
