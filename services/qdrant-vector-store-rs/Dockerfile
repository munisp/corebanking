FROM rust:1.88-slim AS builder
WORKDIR /app
# Cargo.lock is not vendored in this tree and cannot be generated offline
# (no cargo toolchain / crates.io unreachable in the gate environment); the fleet
# builds without --locked, so the lockfile is resolved at image build time.
COPY Cargo.toml ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs && cargo build --release 2>/dev/null; rm -rf src
COPY . .
RUN cargo build --release

FROM rust:1.88-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates wget && rm -rf /var/lib/apt/lists/*
RUN useradd -m appuser
WORKDIR /app
COPY --from=builder /app/target/release/qdrant-vector-store-rs /app/service
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:${PORT:-8295}/healthz || exit 1
EXPOSE 8295
ENTRYPOINT ["./service"]
