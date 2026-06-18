FROM rust:1.88-slim AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs && cargo build --release; rm -rf src
COPY . .
RUN cargo build --release

FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates wget && rm -rf /var/lib/apt/lists/*
RUN useradd -m appuser
WORKDIR /app
COPY --from=builder /app/target/release/etd-trading-rs /app/service
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:${PORT:-8080}/healthz || exit 1
ENTRYPOINT ["./service"]
