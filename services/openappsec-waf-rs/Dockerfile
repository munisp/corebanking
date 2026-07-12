FROM rust:1.75-slim AS builder
WORKDIR /app
COPY Cargo.toml ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs && cargo build --release && rm -rf src
COPY src/ src/
RUN touch src/main.rs && cargo build --release
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/openappsec-waf-rs /usr/local/bin/
EXPOSE 8276
CMD ["openappsec-waf-rs"]
