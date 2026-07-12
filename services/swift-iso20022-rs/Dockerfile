FROM rust:1.77 AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release
FROM debian:bookworm-slim
COPY --from=builder /app/target/release/swift-iso20022-rs /usr/local/bin/
EXPOSE 8112
CMD ["swift-iso20022-rs"]
