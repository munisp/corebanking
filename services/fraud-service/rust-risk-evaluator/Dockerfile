FROM rust:1.88-bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
RUN mkdir -p src && echo 'fn main() {}' > src/main.rs && cargo build --release || true
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/rust-risk-evaluator /usr/local/bin/rust-risk-evaluator
EXPOSE 8092
CMD ["rust-risk-evaluator", "serve", "--host", "0.0.0.0", "--port", "8092"]
