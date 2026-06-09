FROM rust:1.78-alpine AS builder
RUN apk add musl-dev
WORKDIR /app
COPY Cargo.toml ./
COPY src/ src/
RUN cargo build --release
FROM alpine:3.19
COPY --from=builder /app/target/release/* /service
EXPOSE 8080
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8080/healthz || exit 1
CMD ["/service"]
