FROM rust:1.75-slim-bookworm AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src/ ./src/
RUN cargo build --release

FROM debian:bookworm-slim
RUN adduser --disabled-password --gecos '' appuser
USER appuser
WORKDIR /app
COPY --from=builder /app/target/release/commodity_exchange .
ENV PORT=8597
EXPOSE 8597
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8597/healthz || exit 1
CMD ["./commodity_exchange"]
