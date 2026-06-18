FROM rust:1.77 AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release
FROM debian:bookworm-slim
COPY --from=builder /app/target/release/sanctions-engine-rs /usr/local/bin/
EXPOSE 8121
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8121/healthz || exit 1
CMD ["sanctions-engine-rs"]
