FROM rust:1.75-slim-bookworm AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src/ ./src/
RUN cargo build --release

FROM debian:bookworm-slim
RUN adduser --disabled-password --gecos '' appuser
USER appuser
WORKDIR /app
COPY --from=builder /app/target/release/livestock_insurance .
ENV PORT=8607
EXPOSE 8607
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8607/healthz || exit 1
CMD ["./livestock_insurance"]
