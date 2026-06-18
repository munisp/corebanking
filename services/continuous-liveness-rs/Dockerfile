FROM rust:1.83-slim AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release
FROM debian:bookworm-slim
COPY --from=builder /app/target/release/continuous-liveness-rs /usr/local/bin/
CMD ["continuous-liveness-rs"]
