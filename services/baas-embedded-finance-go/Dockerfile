FROM golang:1.22-alpine AS build
WORKDIR /app
COPY . .
RUN go build -o server .
FROM alpine:3.19
COPY --from=build /app/server /server
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8100/healthz || exit 1
CMD ["/server"]
