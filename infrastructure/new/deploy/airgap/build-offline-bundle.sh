#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 54Bank Air-Gapped Deployment — Offline Bundle Builder
# Builds a self-contained tarball with all images, charts, and binaries
# for deployment without internet access.
#
# Run this on a machine WITH internet access:
#   ./deploy/airgap/build-offline-bundle.sh
#
# Transfer the resulting tarball to the air-gapped environment:
#   scp 54bank-offline-bundle.tar.gz admin@target:/opt/54bank/
#
# On the air-gapped target:
#   ./deploy/airgap/install-offline.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

BUNDLE_DIR="/tmp/54bank-offline-bundle"
REGISTRY_IMAGES=(
  "postgres:16-alpine"
  "redis:7-alpine"
  "bitnami/kafka:3.7"
  "nginx:1.25-alpine"
  "node:20-alpine"
  "grafana/grafana:10.4.0"
  "prom/prometheus:v2.51.0"
  "quay.io/keycloak/keycloak:24.0"
  "registry:2"
  "rancher/k3s:v1.29.4-k3s1"
)

echo "═══════════════════════════════════════════════"
echo "  54Bank Offline Bundle Builder"
echo "═══════════════════════════════════════════════"

rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"/{images,binaries,charts,config,scripts}

# ── 1. Pull and save container images ─────────────────────
echo "→ Pulling container images..."
for img in "${REGISTRY_IMAGES[@]}"; do
  echo "  Pulling ${img}..."
  docker pull "${img}" 2>/dev/null || echo "  WARN: Could not pull ${img}"
done

echo "→ Saving images to tarball..."
docker save "${REGISTRY_IMAGES[@]}" -o "$BUNDLE_DIR/images/platform-images.tar" 2>/dev/null || true

# ── 2. Build 54Bank application image ─────────────────────
echo "→ Building 54Bank application image..."
docker build -t 54bank/platform:latest -f Dockerfile . 2>/dev/null || echo "  WARN: Dockerfile build skipped"
docker save 54bank/platform:latest -o "$BUNDLE_DIR/images/54bank-platform.tar" 2>/dev/null || true

# ── 3. Download K3s binary ────────────────────────────────
echo "→ Downloading K3s binary..."
K3S_VERSION="v1.29.4+k3s1"
curl -sSfL "https://github.com/k3s-io/k3s/releases/download/${K3S_VERSION}/k3s" \
  -o "$BUNDLE_DIR/binaries/k3s" 2>/dev/null || echo "  WARN: K3s download skipped"
curl -sSfL "https://github.com/k3s-io/k3s/releases/download/${K3S_VERSION}/k3s-airgap-images-amd64.tar.zst" \
  -o "$BUNDLE_DIR/binaries/k3s-airgap-images.tar.zst" 2>/dev/null || echo "  WARN: K3s images download skipped"
chmod +x "$BUNDLE_DIR/binaries/k3s" 2>/dev/null || true

# ── 4. Download Helm binary ──────────────────────────────
echo "→ Downloading Helm..."
curl -sSfL "https://get.helm.sh/helm-v3.14.4-linux-amd64.tar.gz" \
  -o "$BUNDLE_DIR/binaries/helm.tar.gz" 2>/dev/null || echo "  WARN: Helm download skipped"

# ── 5. Package Helm charts ───────────────────────────────
echo "→ Packaging Helm charts..."
cp -r helm/54bank "$BUNDLE_DIR/charts/"
cp -r deploy/ansible "$BUNDLE_DIR/scripts/ansible"

# ── 6. Copy configuration ────────────────────────────────
echo "→ Copying configuration..."
cp config/postgresql.conf "$BUNDLE_DIR/config/"
cp config/pgbouncer.ini "$BUNDLE_DIR/config/"
cp drizzle/indexes.sql "$BUNDLE_DIR/config/"
cp docker-compose.yml "$BUNDLE_DIR/config/"
cp docker-compose.production.yml "$BUNDLE_DIR/config/" 2>/dev/null || true

# ── 7. Copy deployment scripts ───────────────────────────
cp deploy/airgap/install-offline.sh "$BUNDLE_DIR/scripts/"
cp deploy/airgap/setup-registry.sh "$BUNDLE_DIR/scripts/"
chmod +x "$BUNDLE_DIR/scripts/"*.sh

# ── 8. Generate checksums ────────────────────────────────
echo "→ Generating checksums..."
cd "$BUNDLE_DIR"
find . -type f -exec sha256sum {} \; > checksums.sha256

# ── 9. Create final tarball ──────────────────────────────
echo "→ Creating offline bundle..."
cd /tmp
tar -czf 54bank-offline-bundle.tar.gz -C "$BUNDLE_DIR" .

BUNDLE_SIZE=$(du -sh /tmp/54bank-offline-bundle.tar.gz | cut -f1)

echo ""
echo "═══════════════════════════════════════════════"
echo "  Offline Bundle Ready"
echo "═══════════════════════════════════════════════"
echo ""
echo "  File: /tmp/54bank-offline-bundle.tar.gz"
echo "  Size: ${BUNDLE_SIZE}"
echo ""
echo "  Transfer to air-gapped environment:"
echo "    scp /tmp/54bank-offline-bundle.tar.gz admin@target:/opt/54bank/"
echo ""
echo "  Install on target:"
echo "    cd /opt/54bank && tar xzf 54bank-offline-bundle.tar.gz"
echo "    ./scripts/install-offline.sh"
echo ""
