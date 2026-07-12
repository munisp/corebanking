FROM rust:1.75-slim AS builder
WORKDIR /app
COPY Cargo.toml ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY src/ src/
RUN cargo build --release

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /app/target/release/operations-control-gl-rs .
EXPOSE 8099
CMD ["./operations-control-gl-rs"]
