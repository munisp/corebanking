FROM rust:1.77-alpine AS builder
WORKDIR /app
COPY Cargo.toml .
COPY src/ src/
RUN apk add musl-dev && cargo build --release

FROM alpine:3.19
COPY --from=builder /app/target/release/relationship-pricing /service
EXPOSE 8200
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8200/healthz || exit 1
CMD ["/service"]
