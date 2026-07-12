FROM rust:1.77-slim AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY main.rs ./src/main.rs
RUN mkdir -p src && cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/circuit-breaker-rs /usr/local/bin/
ENV PORT=8260
EXPOSE 8260
CMD ["circuit-breaker-rs"]
