#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 54Bank MicroCloud Deployment Script
# Deploys the full platform on Canonical MicroCloud (LXD + MicroCeph + MicroOVN)
#
# Prerequisites:
#   - MicroCloud cluster initialized (3+ nodes)
#   - LXD profile created: lxc profile create 54bank < deploy/microcloud/lxd-profile.yaml
#
# Usage:
#   ./deploy/microcloud/deploy.sh [staging|production]
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ENV="${1:-staging}"
DOMAIN="${2:-54bank.local}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 24)}"
CLUSTER_NAME="54bank-${ENV}"

echo "═══════════════════════════════════════════════"
echo "  54Bank MicroCloud Deployment — ${ENV}"
echo "═══════════════════════════════════════════════"

# ── 1. Create network ──────────────────────────────────────
echo "→ Creating OVN network..."
lxc network create 54bank-net --type=ovn \
  network=UPLINK \
  ipv4.address=10.54.0.1/16 \
  ipv4.nat=true \
  ipv6.address=none 2>/dev/null || echo "  Network already exists"

# ── 2. Import 54bank profile ──────────────────────────────
echo "→ Importing LXD profile..."
lxc profile create 54bank 2>/dev/null || echo "  Profile already exists"
cat deploy/microcloud/lxd-profile.yaml | lxc profile edit 54bank

# ── 3. Launch database container ──────────────────────────
echo "→ Launching PostgreSQL container..."
lxc launch ubuntu:22.04 ${CLUSTER_NAME}-db \
  --profile=54bank \
  --config=limits.cpu=4 \
  --config=limits.memory=16GB \
  --target="$(lxc cluster list -f csv | head -1 | cut -d, -f1)" 2>/dev/null || echo "  DB container already exists"

echo "→ Waiting for DB container..."
sleep 15

echo "→ Configuring PostgreSQL..."
lxc exec ${CLUSTER_NAME}-db -- bash -c "
  # PostgreSQL tuning
  cat > /etc/postgresql/16/main/conf.d/54bank.conf <<EOF
shared_buffers = '4GB'
effective_cache_size = '12GB'
work_mem = '64MB'
maintenance_work_mem = '1GB'
wal_buffers = '64MB'
max_wal_size = '4GB'
checkpoint_completion_target = 0.9
random_page_cost = 1.1
effective_io_concurrency = 200
default_statistics_target = 500
max_parallel_workers_per_gather = 2
autovacuum_max_workers = 4
autovacuum_vacuum_scale_factor = 0.02
statement_timeout = '60s'
idle_in_transaction_session_timeout = '30s'
jit = on
listen_addresses = '*'
EOF

  echo 'host all all 10.54.0.0/16 scram-sha-256' >> /etc/postgresql/16/main/pg_hba.conf
  systemctl restart postgresql
  sudo -u postgres psql -c \"CREATE USER ndsep_user WITH PASSWORD '${DB_PASSWORD}' CREATEDB;\"
  sudo -u postgres psql -c \"CREATE DATABASE ndsep_db OWNER ndsep_user;\"
"

echo "→ Configuring Redis..."
lxc exec ${CLUSTER_NAME}-db -- bash -c "
  sed -i 's/bind 127.0.0.1/bind 0.0.0.0/' /etc/redis/redis.conf
  echo 'maxmemory 2gb' >> /etc/redis/redis.conf
  echo 'maxmemory-policy allkeys-lru' >> /etc/redis/redis.conf
  systemctl restart redis
"

DB_IP=$(lxc list ${CLUSTER_NAME}-db -f csv -c 4 | head -1 | cut -d' ' -f1)
echo "  PostgreSQL IP: ${DB_IP}"

# ── 4. Launch K8s master ──────────────────────────────────
echo "→ Launching K8s master..."
lxc launch ubuntu:22.04 ${CLUSTER_NAME}-k8s-master \
  --profile=54bank \
  --config=limits.cpu=4 \
  --config=limits.memory=16GB 2>/dev/null || echo "  K8s master already exists"

sleep 15

echo "→ Installing K3s on master..."
MASTER_IP=$(lxc list ${CLUSTER_NAME}-k8s-master -f csv -c 4 | head -1 | cut -d' ' -f1)

lxc exec ${CLUSTER_NAME}-k8s-master -- bash -c "
  curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC='server \
    --cluster-init \
    --tls-san ${MASTER_IP} \
    --write-kubeconfig-mode 644' sh -
  sleep 20
  
  # Install Helm
  curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
"

K3S_TOKEN=$(lxc exec ${CLUSTER_NAME}-k8s-master -- cat /var/lib/rancher/k3s/server/node-token)

# ── 5. Launch K8s workers ─────────────────────────────────
WORKER_COUNT=3
if [ "${ENV}" = "staging" ]; then WORKER_COUNT=2; fi

for i in $(seq 1 ${WORKER_COUNT}); do
  echo "→ Launching K8s worker ${i}..."
  lxc launch ubuntu:22.04 ${CLUSTER_NAME}-k8s-worker-${i} \
    --profile=54bank \
    --config=limits.cpu=4 \
    --config=limits.memory=16GB 2>/dev/null || echo "  Worker ${i} already exists"
  
  sleep 10
  
  lxc exec ${CLUSTER_NAME}-k8s-worker-${i} -- bash -c "
    curl -sfL https://get.k3s.io | K3S_URL=https://${MASTER_IP}:6443 K3S_TOKEN=${K3S_TOKEN} sh -
  "
done

# ── 6. Deploy 54Bank ─────────────────────────────────────
echo "→ Deploying 54Bank platform..."
lxc exec ${CLUSTER_NAME}-k8s-master -- bash -c "
  # Create namespace
  kubectl create namespace 54bank 2>/dev/null || true
  
  # Create DB secret
  kubectl create secret generic 54bank-db -n 54bank \
    --from-literal=DATABASE_URL='postgresql://ndsep_user:${DB_PASSWORD}@${DB_IP}:5432/ndsep_db' \
    --from-literal=REDIS_URL='redis://${DB_IP}:6379' \
    2>/dev/null || true
"

# Copy Helm chart and deploy
lxc file push -r helm/54bank ${CLUSTER_NAME}-k8s-master/tmp/
lxc exec ${CLUSTER_NAME}-k8s-master -- bash -c "
  helm upgrade --install 54bank /tmp/54bank \
    --namespace 54bank \
    --set environment=${ENV} \
    --set database.host=${DB_IP} \
    --set redis.host=${DB_IP} \
    --set ingress.host=${DOMAIN} \
    --wait --timeout=5m
"

# ── 7. Output ────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  54Bank Deployment Complete"
echo "═══════════════════════════════════════════════"
echo ""
echo "  Environment:   ${ENV}"
echo "  K8s API:       https://${MASTER_IP}:6443"
echo "  PostgreSQL:    postgresql://ndsep_user:****@${DB_IP}:5432/ndsep_db"
echo "  Redis:         redis://${DB_IP}:6379"
echo "  Platform URL:  https://${DOMAIN}"
echo ""
echo "  Get kubeconfig:"
echo "    lxc exec ${CLUSTER_NAME}-k8s-master -- cat /etc/rancher/k3s/k3s.yaml"
echo ""
echo "  Run migrations:"
echo "    lxc exec ${CLUSTER_NAME}-k8s-master -- kubectl exec -it deploy/54bank-api -n 54bank -- pnpm db:migrate"
echo ""
echo "  Seed database:"
echo "    lxc exec ${CLUSTER_NAME}-k8s-master -- kubectl exec -it deploy/54bank-api -n 54bank -- pnpm db:seed"
echo ""
