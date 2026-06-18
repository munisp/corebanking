# 54Bank On-Premise Deployment Guide

Deploy the 54Bank Core Banking Platform on your own infrastructure — OpenStack, Canonical MicroCloud, bare-metal, or air-gapped environments.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Hardware Requirements](#hardware-requirements)
3. [Deployment Options](#deployment-options)
4. [OpenStack Deployment](#openstack-deployment)
5. [MicroCloud / LXD Deployment](#microcloud--lxd-deployment)
6. [Bare-Metal / VM Deployment (Ansible)](#bare-metal--vm-deployment-ansible)
7. [Air-Gapped Deployment](#air-gapped-deployment)
8. [Database Performance Tuning](#database-performance-tuning)
9. [Post-Deployment](#post-deployment)
10. [Monitoring & Operations](#monitoring--operations)
11. [Backup & Recovery](#backup--recovery)
12. [Security Hardening](#security-hardening)

---

## Architecture Overview

```
                    ┌─────────────────────┐
                    │   Load Balancer      │
                    │   (Octavia / HAProxy)│
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
        │ K8s Node 1 │  │ K8s Node 2 │  │ K8s Node 3 │
        │ 54Bank API │  │ 54Bank API │  │ 54Bank API │
        │ + Workers  │  │ + Workers  │  │ + Workers  │
        └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
        │ PostgreSQL │  │   Redis   │  │   Kafka   │
        │  Primary   │  │  Cluster  │  │  Cluster  │
        │ + PgBouncer│  │           │  │ (optional)│
        └───────────┘  └───────────┘  └───────────┘
```

## Hardware Requirements

### Minimum (Staging / MFB Pilot)

| Component | vCPU | RAM | Storage | Count |
|-----------|------|-----|---------|-------|
| K8s Master | 2 | 8 GB | 50 GB SSD | 1 |
| K8s Worker | 4 | 16 GB | 100 GB SSD | 2 |
| Database | 4 | 16 GB | 200 GB NVMe | 1 |
| **Total** | **14** | **56 GB** | **500 GB** | **4 nodes** |

### Recommended (Production)

| Component | vCPU | RAM | Storage | Count |
|-----------|------|-----|---------|-------|
| K8s Master | 4 | 16 GB | 100 GB SSD | 3 (HA) |
| K8s Worker | 8 | 32 GB | 200 GB SSD | 3-10 |
| DB Primary | 8 | 32 GB | 500 GB NVMe | 1 |
| DB Replica | 8 | 32 GB | 500 GB NVMe | 1-2 |
| Redis | 4 | 16 GB | 50 GB SSD | 3 (Sentinel) |
| **Total** | **60+** | **224+ GB** | **2.5+ TB** | **12+ nodes** |

### Network Requirements

- 1 Gbps minimum between nodes (10 Gbps recommended)
- Latency < 1ms between app and database nodes
- Ports: 22 (SSH), 80/443 (HTTP/S), 5432 (Postgres), 6379 (Redis), 6443 (K8s API), 9092 (Kafka)

---

## Deployment Options

| Method | Best For | Internet Required | Complexity |
|--------|----------|-------------------|------------|
| [OpenStack Heat](#openstack-deployment) | Private cloud with OpenStack | Yes (first deploy) | Medium |
| [MicroCloud / LXD](#microcloud--lxd-deployment) | Small data centers (3-12 nodes) | Yes (first deploy) | Low |
| [Ansible](#bare-metal--vm-deployment-ansible) | Bare-metal, any Linux VMs | Yes (first deploy) | Medium |
| [Air-Gapped](#air-gapped-deployment) | Secure / restricted networks | **No** | High |

---

## OpenStack Deployment

### Prerequisites
- OpenStack Queens+ with Heat, Neutron, Nova, Cinder, Octavia
- SSH key pair uploaded to OpenStack
- External network configured

### Deploy

```bash
# Set database password
export DB_PASSWORD=$(openssl rand -base64 24)

# Create stack (staging)
openstack stack create 54bank-staging \
  -t deploy/openstack/heat-template.yaml \
  -e deploy/openstack/env-staging.yaml \
  --parameter db_password="${DB_PASSWORD}"

# Create stack (production)
openstack stack create 54bank-production \
  -t deploy/openstack/heat-template.yaml \
  -e deploy/openstack/env-production.yaml \
  --parameter db_password="${DB_PASSWORD}"

# Monitor deployment
openstack stack show 54bank-production
openstack stack event list 54bank-production
```

### Post-Stack Setup
```bash
# Get outputs
K8S_IP=$(openstack stack output show 54bank-production k8s_api_endpoint -f value -c output_value)

# SSH to master
ssh ubuntu@${K8S_IP}

# Deploy 54Bank Helm chart
helm install 54bank ./helm/54bank -f helm/54bank/values-onpremise.yaml
```

---

## MicroCloud / LXD Deployment

### Prerequisites
- 3+ bare-metal nodes with Ubuntu 22.04+
- MicroCloud snap installed on all nodes

### Initialize MicroCloud
```bash
# On all nodes
sudo snap install microcloud lxd microceph microovn

# On first node — interactive cluster setup
sudo microcloud init
```

### Deploy 54Bank
```bash
# Set database password
export DB_PASSWORD=$(openssl rand -base64 24)

# Run deployment script
./deploy/microcloud/deploy.sh production 54bank.local

# Verify
lxc list | grep 54bank
```

### Manage
```bash
# Get kubeconfig
lxc exec 54bank-production-k8s-master -- cat /etc/rancher/k3s/k3s.yaml

# Scale workers
lxc launch ubuntu:22.04 54bank-production-k8s-worker-4 --profile=54bank

# Monitor
lxc exec 54bank-production-k8s-master -- kubectl get pods -n 54bank
```

---

## Bare-Metal / VM Deployment (Ansible)

### Prerequisites
- Ubuntu 22.04 on all target nodes
- SSH access with sudo privileges
- Python 3 on target nodes
- Ansible 2.14+ on control machine

### Setup
```bash
# Install Ansible
pip install ansible

# Install required collections
ansible-galaxy collection install community.postgresql

# Edit inventory
cp deploy/ansible/inventory.ini deploy/ansible/my-inventory.ini
# Update IPs, SSH key path, etc.
```

### Deploy
```bash
cd deploy/ansible

# Full deployment
export DB_PASSWORD=$(openssl rand -base64 24)
ansible-playbook -i my-inventory.ini playbook.yaml

# Database only
ansible-playbook -i my-inventory.ini playbook.yaml --tags database

# K8s cluster only
ansible-playbook -i my-inventory.ini playbook.yaml --tags k8s

# Application deployment only
ansible-playbook -i my-inventory.ini playbook.yaml --tags deploy
```

---

## Air-Gapped Deployment

For environments without internet access (secure data centers, government, military).

### Step 1: Build Offline Bundle (on internet-connected machine)
```bash
# Requires Docker installed
./deploy/airgap/build-offline-bundle.sh

# Output: /tmp/54bank-offline-bundle.tar.gz (~2-5 GB)
```

### Step 2: Transfer to Air-Gapped Environment
```bash
# USB drive, secure file transfer, etc.
scp /tmp/54bank-offline-bundle.tar.gz admin@target:/opt/54bank/
```

### Step 3: Install
```bash
ssh admin@target
cd /opt/54bank
tar xzf 54bank-offline-bundle.tar.gz
export DB_PASSWORD=$(openssl rand -base64 24)
sudo ./scripts/install-offline.sh
```

---

## Database Performance Tuning

### PostgreSQL Configuration
The platform ships with production-tuned PostgreSQL config at `config/postgresql.conf`:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `shared_buffers` | 4 GB | 25% of 16 GB RAM |
| `effective_cache_size` | 12 GB | 75% of RAM |
| `work_mem` | 64 MB | Per-sort allocation |
| `maintenance_work_mem` | 1 GB | VACUUM/INDEX operations |
| `wal_buffers` | 64 MB | WAL write buffer |
| `max_wal_size` | 4 GB | Before forced checkpoint |
| `checkpoint_completion_target` | 0.9 | Spread I/O |
| `random_page_cost` | 1.1 | SSD-optimized |
| `effective_io_concurrency` | 200 | NVMe concurrent reads |
| `jit` | on | JIT for complex queries |
| `autovacuum_vacuum_scale_factor` | 0.02 | Aggressive vacuum (2%) |

### Apply Configuration
```bash
# Copy to PostgreSQL config directory
cp config/postgresql.conf /etc/postgresql/16/main/conf.d/54bank.conf
systemctl restart postgresql
```

### Create Performance Indexes
```bash
# 40+ indexes for all hot query paths
psql $DATABASE_URL -f drizzle/indexes.sql
```

Key indexes include:
- `idx_accounts_customer_status` — Account lookups by customer
- `idx_txn_created_brin` — BRIN index for time-series transaction queries
- `idx_txn_reference_unique` — Idempotency dedup for NIP/Mojaloop
- `idx_audit_entity_ts` — Audit trail entity lookup (critical query)
- `idx_aml_pending_risk` — AML alert triage by risk score
- `idx_customers_name_trgm` — Trigram search for customer name lookup

### Connection Pooling (PgBouncer)
```bash
# Deploy PgBouncer (sits between app and PostgreSQL)
cp config/pgbouncer.ini /etc/pgbouncer/pgbouncer.ini

# Key settings:
# pool_mode = transaction (release after each transaction)
# default_pool_size = 30
# max_client_conn = 1000 (many microservices)
# max_db_connections = 80 (protect Postgres)
```

### Read Replica Routing
Set `DATABASE_REPLICA_URL` to automatically route SELECT queries to read replicas:
```bash
export DATABASE_URL=postgresql://user:pass@primary:5432/ndsep_db
export DATABASE_REPLICA_URL=postgresql://user:pass@replica:5432/ndsep_db
```

### Monitoring Endpoints
- `GET /api/db/health` — Pool utilization, prepared statement stats
- `GET /api/db/slow-queries` — Slow queries from pg_stat_statements
- `GET /api/db/table-stats` — Table row counts, dead rows, vacuum status
- `GET /api/db/index-stats` — Index usage and sizes
- `GET /api/db/cache-stats` — Buffer cache hit ratio

---

## Post-Deployment

### 1. Run Database Migrations
```bash
kubectl exec -it deploy/54bank-api -n 54bank -- pnpm db:migrate
```

### 2. Seed Initial Data
```bash
kubectl exec -it deploy/54bank-api -n 54bank -- pnpm db:seed
```

### 3. Create Performance Indexes
```bash
kubectl exec -it deploy/54bank-api -n 54bank -- \
  psql $DATABASE_URL -f drizzle/indexes.sql
```

### 4. Verify Platform
```bash
# Health check
curl -k https://54bank.local/healthz

# Expected response:
# { "status": "ok", "database": "connected", "tables": 267, "redis": "connected" }
```

---

## Monitoring & Operations

### Health Checks
```bash
# Platform health
curl https://54bank.local/healthz

# Database pool health
curl https://54bank.local/api/db/health

# Pod status
kubectl get pods -n 54bank -o wide
```

### Scaling
```bash
# Scale API replicas
kubectl scale deployment 54bank-api -n 54bank --replicas=5

# Add K8s worker node
# (Use Ansible or manual K3s join)
```

### Log Aggregation
```bash
# View API logs
kubectl logs -f deployment/54bank-api -n 54bank

# View all pods
kubectl logs -f -l app=54bank -n 54bank --all-containers
```

---

## Backup & Recovery

### Automated Backups
Helm chart includes a CronJob for daily backups at 2 AM:
```yaml
# In values-onpremise.yaml
backup:
  enabled: true
  schedule: "0 2 * * *"
  retention: 30
```

### Manual Backup
```bash
# Full database backup
pg_dump -Fc -h localhost -U ndsep_user ndsep_db > backup_$(date +%Y%m%d).dump

# Restore
pg_restore -h localhost -U ndsep_user -d ndsep_db backup_20260515.dump
```

### Point-in-Time Recovery
WAL archiving is enabled by default. To restore to a specific time:
```bash
# Stop PostgreSQL
systemctl stop postgresql

# Restore base backup + replay WAL
pg_basebackup -h primary -D /var/lib/postgresql/16/main
echo "recovery_target_time = '2026-05-15 14:30:00'" > /var/lib/postgresql/16/main/recovery.signal

# Start PostgreSQL
systemctl start postgresql
```

---

## Security Hardening

### Network
- All inter-node traffic on private network (10.54.0.0/16)
- Security groups restrict access by role (K8s, DB, LB)
- K8s network policies limit pod-to-pod communication

### Database
- SCRAM-SHA-256 authentication (not MD5)
- TLS encryption for client connections (configurable)
- Connection via PgBouncer only (no direct Postgres access)
- Statement timeout (60s) and idle-in-transaction timeout (30s)

### Application
- JWT + RBAC with 6 roles (admin, operations, teller, auditor, compliance, customer)
- MFA/TOTP (RFC 6238) for sensitive operations
- OWASP security headers (HSTS, CSP, X-Frame-Options)
- Brute force protection (5 attempts → 15-minute lockout)
- CORS whitelist (no wildcard in production)

### Kubernetes
- Pod security standards enforced
- Network policies for namespace isolation
- Secrets in K8s Secrets (not environment variables)
- RBAC for cluster access

---

## Support

For issues with on-premise deployment:
1. Check logs: `kubectl logs -f deploy/54bank-api -n 54bank`
2. Check database: `psql $DATABASE_URL -c "SELECT 1"`
3. Check connectivity: `curl -k https://54bank.local/healthz`
4. Review this guide's troubleshooting section
