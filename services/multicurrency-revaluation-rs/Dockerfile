FROM rust:1.88-alpine AS builder
WORKDIR /app
COPY Cargo.toml .
COPY src/ src/
RUN apk add musl-dev && cargo build --release

FROM alpine:3.19
COPY --from=builder /app/target/release/multicurrency-revaluation /service
EXPOSE 8200
CMD ["/service"]
