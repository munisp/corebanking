FROM rust:1.88-slim AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src/ ./src/
RUN cargo build --release
FROM debian:trixie-slim
COPY --from=builder /app/target/release/dormancy-management /usr/local/bin/
CMD ["dormancy-management"]
