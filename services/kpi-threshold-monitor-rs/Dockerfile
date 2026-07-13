FROM rust:1.77-slim AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/kpi-threshold-monitor-rs .
EXPOSE 8501
CMD ["./kpi-threshold-monitor-rs"]
