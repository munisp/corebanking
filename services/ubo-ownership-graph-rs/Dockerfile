FROM rust:1.83-slim AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release
FROM debian:bookworm-slim
COPY --from=builder /app/target/release/ubo-ownership-graph-rs /usr/local/bin/
CMD ["ubo-ownership-graph-rs"]
