FROM rust:1.88-slim AS builder
WORKDIR /app
COPY Cargo.toml ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY src/ src/
RUN touch src/main.rs && cargo build --release
FROM debian:trixie-slim
COPY --from=builder /app/target/release/hsm-key-manager-rs /usr/local/bin/service
EXPOSE 8486
CMD ["service"]
