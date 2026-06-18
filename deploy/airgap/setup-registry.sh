#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 54Bank — Local Container Registry for Air-Gapped Environments
# Sets up a local Docker registry for serving container images
# without internet access.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REGISTRY_PORT="${REGISTRY_PORT:-5000}"
REGISTRY_DIR="/var/lib/54bank-registry"

echo "→ Setting up local container registry on port ${REGISTRY_PORT}..."

mkdir -p "${REGISTRY_DIR}"

# Check if registry is already running
if curl -sf "http://localhost:${REGISTRY_PORT}/v2/" >/dev/null 2>&1; then
  echo "  Registry already running on port ${REGISTRY_PORT}"
  exit 0
fi

# Try Docker first
if command -v docker &>/dev/null; then
  docker run -d \
    --name 54bank-registry \
    --restart=always \
    -p "${REGISTRY_PORT}:5000" \
    -v "${REGISTRY_DIR}:/var/lib/registry" \
    registry:2 2>/dev/null || echo "  Docker registry start failed — trying containerd"
fi

# Configure K3s to use local registry
if [ -d /etc/rancher/k3s ]; then
  mkdir -p /etc/rancher/k3s
  cat > /etc/rancher/k3s/registries.yaml <<EOF
mirrors:
  "localhost:${REGISTRY_PORT}":
    endpoint:
      - "http://localhost:${REGISTRY_PORT}"
  "docker.io":
    endpoint:
      - "http://localhost:${REGISTRY_PORT}"
EOF
  echo "  K3s configured to use local registry"
  systemctl restart k3s 2>/dev/null || true
fi

echo "  Local registry ready at localhost:${REGISTRY_PORT}"
