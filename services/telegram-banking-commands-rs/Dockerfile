FROM rust:1.75-slim AS builder
WORKDIR /app
COPY Cargo.toml ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs && cargo build --release && rm -rf src
COPY src/ src/
RUN cargo build --release

FROM gcr.io/distroless/cc
COPY --from=builder /app/target/release/telegram_banking_commands /service
EXPOSE 8638
USER nonroot
HEALTHCHECK --interval=30s --timeout=3s CMD ["/service","healthz"]
ENTRYPOINT ["/service"]
