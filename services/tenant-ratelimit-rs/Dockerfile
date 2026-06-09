FROM rust:1.83 AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/tenant-ratelimit-rs /usr/local/bin/tenant-ratelimit-rs
EXPOSE 8259
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8259/healthz || exit 1
CMD ["tenant-ratelimit-rs"]
