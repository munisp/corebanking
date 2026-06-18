FROM rust:1.77-slim AS build
WORKDIR /app
COPY Cargo.toml ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs && cargo build --release && rm -rf src
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/target/release/fraud-detection /usr/local/bin/
EXPOSE 8112
CMD ["fraud-detection"]
