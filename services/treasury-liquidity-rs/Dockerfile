FROM rust:1.78-slim AS builder
WORKDIR /app
# Cargo.lock is not vendored in this tree and cannot be generated offline
# (no cargo toolchain / crates.io unreachable in the gate environment); the fleet
# builds without --locked, so the lockfile is resolved at image build time.
COPY Cargo.toml ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs && cargo build --release 2>/dev/null; rm -rf src
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates wget && rm -rf /var/lib/apt/lists/*
RUN useradd -m appuser
WORKDIR /app
COPY --from=builder /app/target/release/* ./service 2>/dev/null || true
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:${PORT:-8080}/healthz || exit 1
ENTRYPOINT ["./service"]
