FROM rust:1.77-alpine AS builder
WORKDIR /app
COPY Cargo.toml .
COPY src/ src/
RUN apk add musl-dev && cargo build --release

FROM alpine:3.19
COPY --from=builder /app/target/release/relationship-pricing /service
EXPOSE 8200
CMD ["/service"]
