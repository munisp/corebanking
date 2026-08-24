FROM rust:1.77-slim AS builder
WORKDIR /app
COPY Cargo.toml .
COPY src/ src/
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/billing-enforcement /usr/local/bin/
EXPOSE 8108
CMD ["billing-enforcement"]
