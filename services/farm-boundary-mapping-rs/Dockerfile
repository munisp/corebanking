FROM rust:1.75-slim-bookworm AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src/ ./src/
RUN cargo build --release

FROM debian:bookworm-slim
RUN adduser --disabled-password --gecos '' appuser
USER appuser
WORKDIR /app
COPY --from=builder /app/target/release/farm_boundary_mapping .
ENV PORT=8603
EXPOSE 8603
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8603/healthz || exit 1
CMD ["./farm_boundary_mapping"]
