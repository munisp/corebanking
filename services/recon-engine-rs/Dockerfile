FROM rust:1.77 AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release
FROM debian:bookworm-slim
COPY --from=builder /app/target/release/recon-engine-rs /usr/local/bin/
EXPOSE 8119
CMD ["recon-engine-rs"]
