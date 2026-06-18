FROM rust:1.88-alpine AS builder
RUN apk add --no-cache musl-dev
WORKDIR /app
COPY Cargo.toml .
RUN mkdir src && echo 'fn main(){}' > src/main.rs && cargo build --release 2>/dev/null; rm src/main.rs
COPY src/ src/
RUN touch src/main.rs && cargo build --release

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/target/release/sanctions-screening-rs /usr/local/bin/
EXPOSE 8283
CMD ["sanctions-screening-rs"]
