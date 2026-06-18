FROM rust:1.75-slim AS builder
WORKDIR /app
COPY Cargo.toml ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY src/ src/
RUN touch src/main.rs && cargo build --release
FROM debian:bookworm-slim
COPY --from=builder /app/target/release/field-level-encryption-rs /usr/local/bin/service
EXPOSE 8494
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8494/healthz || exit 1
CMD ["service"]
