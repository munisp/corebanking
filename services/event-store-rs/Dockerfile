FROM rust:1.77-slim AS build
WORKDIR /app
COPY . .
RUN cargo build --release
FROM debian:bookworm-slim
COPY --from=build /app/target/release/event-store /event-store
CMD ["/event-store"]
