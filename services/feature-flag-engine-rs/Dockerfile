FROM rust:1.78-alpine AS builder
RUN apk add musl-dev
WORKDIR /app
COPY Cargo.toml ./
COPY src/ src/
RUN cargo build --release
FROM alpine:3.19
COPY --from=builder /app/target/release/* /service
EXPOSE 8080
CMD ["/service"]
