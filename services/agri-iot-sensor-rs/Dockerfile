FROM rust:1.75-slim-bookworm AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src/ ./src/
RUN cargo build --release

FROM debian:bookworm-slim
RUN adduser --disabled-password --gecos '' appuser
USER appuser
WORKDIR /app
COPY --from=builder /app/target/release/agri_iot_sensor .
ENV PORT=8615
EXPOSE 8615
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8615/healthz || exit 1
CMD ["./agri_iot_sensor"]
