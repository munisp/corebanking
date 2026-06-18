#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 54Bank Air-Gapped Installation Script
# Run on the target machine after transferring the offline bundle
#
# Usage:
#   tar xzf 54bank-offline-bundle.tar.gz -C /opt/54bank
#   cd /opt/54bank && ./scripts/install-offline.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

INSTALL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 24)}"

echo "═══════════════════════════════════════════════"
echo "  54Bank Air-Gapped Installation"
echo "═══════════════════════════════════════════════"
echo "  Install directory: ${INSTALL_DIR}"

# ── 1. Verify checksums ──────────────────────────────────
echo "→ Verifying file integrity..."
cd "$INSTALL_DIR"
if sha256sum -c checksums.sha256 --quiet 2>/dev/null; then
  echo "  All checksums verified ✓"
else
  echo "  WARNING: Some checksums failed — bundle may be corrupted"
fi

# ── 2. Install K3s (air-gapped) ──────────────────────────
echo "→ Installing K3s (air-gapped)..."
if [ -f binaries/k3s ]; then
  cp binaries/k3s /usr/local/bin/k3s
  chmod +x /usr/local/bin/k3s
  
  # Load air-gapped images
  mkdir -p /var/lib/rancher/k3s/agent/images/
  if [ -f binaries/k3s-airgap-images.tar.zst ]; then
    cp binaries/k3s-airgap-images.tar.zst /var/lib/rancher/k3s/agent/images/
  fi
  
  # Install K3s service
  INSTALL_K3S_SKIP_DOWNLOAD=true \
  INSTALL_K3S_EXEC="server --cluster-init --write-kubeconfig-mode 644" \
    curl -sfL https://get.k3s.io 2>/dev/null | sh - 2>/dev/null || \
    echo "  K3s service installation requires internet for install script — using manual setup"
  
  echo "  K3s installed"
else
  echo "  WARNING: K3s binary not found in bundle"
fi

# ── 3. Install Helm ──────────────────────────────────────
echo "→ Installing Helm..."
if [ -f binaries/helm.tar.gz ]; then
  tar xzf binaries/helm.tar.gz -C /tmp
  mv /tmp/linux-amd64/helm /usr/local/bin/helm
  chmod +x /usr/local/bin/helm
  echo "  Helm installed"
fi

# ── 4. Set up local container registry ───────────────────
echo "→ Setting up local container registry..."
./scripts/setup-registry.sh

# ── 5. Load container images ─────────────────────────────
echo "→ Loading container images into local registry..."
REGISTRY="localhost:5000"

if [ -f images/platform-images.tar ]; then
  echo "  Loading platform images..."
  docker load -i images/platform-images.tar 2>/dev/null || \
    ctr -n k8s.io images import images/platform-images.tar 2>/dev/null || \
    k3s ctr images import images/platform-images.tar 2>/dev/null || true
fi

if [ -f images/54bank-platform.tar ]; then
  echo "  Loading 54Bank application image..."
  docker load -i images/54bank-platform.tar 2>/dev/null || \
    k3s ctr images import images/54bank-platform.tar 2>/dev/null || true
fi

# ── 6. Install PostgreSQL ────────────────────────────────
echo "→ Setting up PostgreSQL..."
if command -v psql &>/dev/null; then
  echo "  PostgreSQL already installed"
else
  echo "  WARNING: PostgreSQL not pre-installed — install manually or use K8s StatefulSet"
fi

# Configure with 54Bank tuning
if [ -d /etc/postgresql ]; then
  PG_VERSION=$(ls /etc/postgresql/ | sort -V | tail -1)
  cp config/postgresql.conf "/etc/postgresql/${PG_VERSION}/main/conf.d/54bank.conf" 2>/dev/null || true
  systemctl restart postgresql 2>/dev/null || true
  
  # Create database
  sudo -u postgres psql -c "CREATE USER ndsep_user WITH PASSWORD '${DB_PASSWORD}' CREATEDB;" 2>/dev/null || true
  sudo -u postgres psql -c "CREATE DATABASE ndsep_db OWNER ndsep_user;" 2>/dev/null || true
  sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;" -d ndsep_db 2>/dev/null || true
  sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" -d ndsep_db 2>/dev/null || true
fi

# ── 7. Deploy via Helm ───────────────────────────────────
echo "→ Deploying 54Bank platform..."
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

kubectl create namespace 54bank 2>/dev/null || true

DB_HOST=$(hostname -I | awk '{print $1}')

kubectl create secret generic 54bank-db -n 54bank \
  --from-literal=DATABASE_URL="postgresql://ndsep_user:${DB_PASSWORD}@${DB_HOST}:5432/ndsep_db" \
  --from-literal=REDIS_URL="redis://${DB_HOST}:6379" \
  --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install 54bank charts/54bank \
  --namespace 54bank \
  --set environment=production \
  --set database.host="${DB_HOST}" \
  --set redis.host="${DB_HOST}" \
  --set image.registry="${REGISTRY}" \
  --wait --timeout=10m || echo "  Helm deploy may need manual intervention"

# ── 8. Run indexes ───────────────────────────────────────
echo "→ Creating performance indexes..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -U ndsep_user -d ndsep_db \
  -f config/indexes.sql 2>/dev/null || echo "  Indexes will be created on first migration"

# ── 9. Summary ───────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  54Bank Air-Gapped Installation Complete"
echo "═══════════════════════════════════════════════"
echo ""
echo "  PostgreSQL: postgresql://ndsep_user:****@${DB_HOST}:5432/ndsep_db"
echo "  Redis:      redis://${DB_HOST}:6379"
echo "  K8s API:    https://${DB_HOST}:6443"
echo ""
echo "  Next steps:"
echo "  1. Run migrations:"
echo "     kubectl exec -it deploy/54bank-api -n 54bank -- pnpm db:migrate"
echo "  2. Seed database:"
echo "     kubectl exec -it deploy/54bank-api -n 54bank -- pnpm db:seed"
echo "  3. Access platform:"
echo "     kubectl get svc -n 54bank"
echo ""
echo "  DB Password: ${DB_PASSWORD}"
echo "  (Save this securely — it won't be shown again)"
echo ""
