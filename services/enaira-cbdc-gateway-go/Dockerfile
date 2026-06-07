FROM golang:1.22-alpine AS build
WORKDIR /app
COPY . .
RUN go build -o server .
FROM alpine:3.19
COPY --from=build /app/server /server
CMD ["/server"]
