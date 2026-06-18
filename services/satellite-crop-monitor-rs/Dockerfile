FROM rust:1.75-slim-bookworm AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src/ ./src/
RUN cargo build --release

FROM debian:bookworm-slim
RUN adduser --disabled-password --gecos '' appuser
USER appuser
WORKDIR /app
COPY --from=builder /app/target/release/satellite_crop_monitor .
ENV PORT=8600
EXPOSE 8600
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8600/healthz || exit 1
CMD ["./satellite_crop_monitor"]
