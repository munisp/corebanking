FROM rust:1.77-slim AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/kafka-partition-rebalancer-rs /usr/local/bin/
USER 1000:1000
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8080/healthz || exit 1
CMD ["kafka-partition-rebalancer-rs"]
