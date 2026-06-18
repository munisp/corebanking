FROM rust:1.75-slim AS builder
WORKDIR /app
COPY Cargo.toml ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs && cargo build --release && rm -rf src
COPY src/ src/
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim
RUN useradd -m -u 1001 appuser
COPY --from=builder /app/target/release/hot-data-cache-rs /usr/local/bin/service
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD curl -sf http://localhost:8544/healthz || exit 1
EXPOSE 8544
CMD ["service"]
