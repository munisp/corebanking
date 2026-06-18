FROM rust:1.88-slim AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src/ ./src/
RUN cargo build --release

FROM rust:1.88-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/offline_resilience_rs /usr/local/bin/app
ENTRYPOINT ["app"]
