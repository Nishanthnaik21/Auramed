# Multi-stage Docker build for AuraMed Ingestion Gateway
FROM rust:1.78-bookworm AS builder

WORKDIR /usr/src/auramed-gateway

RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    build-essential \
    libssl-dev \
    pkg-config \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Cache dependencies
COPY Cargo.toml ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release || true
RUN rm -rf src

# Copy source code and build production binary
COPY src ./src
RUN cargo build --release

# Final lightweight runtime image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for healthcare security compliance
RUN groupadd -g 10001 auramed && useradd -u 10001 -g auramed -s /bin/sh -m auramed

WORKDIR /app
COPY --from=builder /usr/src/auramed-gateway/target/release/auramed-ingestion-gateway /app/auramed-ingestion-gateway

RUN chown -R auramed:auramed /app
USER auramed:auramed

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/auramed-ingestion-gateway"]
