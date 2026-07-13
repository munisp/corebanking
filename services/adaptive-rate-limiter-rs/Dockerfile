FROM rust:1.75-slim AS builder
WORKDIR /app
COPY Cargo.toml ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY src/ src/
RUN touch src/main.rs && cargo build --release
FROM debian:bookworm-slim
COPY --from=builder /app/target/release/adaptive-rate-limiter-rs /usr/local/bin/service
EXPOSE 8493
CMD ["service"]
