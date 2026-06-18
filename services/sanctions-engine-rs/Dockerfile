FROM rust:1.77 AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release
FROM debian:bookworm-slim
COPY --from=builder /app/target/release/sanctions-engine-rs /usr/local/bin/
EXPOSE 8121
CMD ["sanctions-engine-rs"]
