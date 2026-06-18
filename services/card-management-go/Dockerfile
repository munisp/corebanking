FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o card-management .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=build /app/card-management /usr/local/bin/
EXPOSE 8109
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8109/healthz || exit 1
CMD ["card-management"]
