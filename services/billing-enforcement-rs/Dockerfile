FROM rust:1.77-slim AS builder
WORKDIR /app
COPY Cargo.toml .
COPY main.rs src/main.rs
RUN mkdir src && mv src/main.rs src/ || true
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/billing-enforcement /usr/local/bin/
EXPOSE 8108
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8108/healthz || exit 1
CMD ["billing-enforcement"]
