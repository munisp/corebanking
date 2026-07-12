FROM rust:1.78-slim AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates wget && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/agriculture-banking /usr/local/bin/agriculture-banking
ENV ADDR=0.0.0.0:8090
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8090/healthz >/dev/null || exit 1
CMD ["agriculture-banking"]
