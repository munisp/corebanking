FROM rust:1.83 AS builder
WORKDIR /app
# Cargo.lock is not vendored in this tree and cannot be generated offline
# (no cargo toolchain / crates.io unreachable in the gate environment); the fleet
# builds without --locked, so the lockfile is resolved at image build time.
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/flag-audit-rs /usr/local/bin/flag-audit-rs
EXPOSE 8256
CMD ["flag-audit-rs"]
