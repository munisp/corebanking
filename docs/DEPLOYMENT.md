# 54Bank Platform — Deployment Guide

## Deployment Targets

54Bank supports three deployment targets:

| Target | Description | Use Case |
|--------|-------------|----------|
| **AWS Cloud** | EKS + RDS Aurora + ElastiCache + MSK | Primary cloud deployment |
| **OpenStack** | Magnum K8s + Trove DB + Octavia LB | Private cloud / co-location |
| **On-Premise** | kubeadm + Patroni + Rook-Ceph + MetalLB | Bare-metal data center |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer                             │
│           (AWS NLB / Octavia / HAProxy+MetalLB)                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                     APISIX API Gateway                           │
│        (Rate limiting, JWT auth, routing, circuit breaking)      │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                   Kubernetes Cluster                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Go (211) │ │Rust (158)│ │Python(141)│ │  Flutter Web (1) │   │
│  │ services │ │ services │ │ services  │ │  566 screens     │   │
│  └──────┬───┘ └──────┬───┘ └──────┬───┘ └──────────────────┘   │
│         │            │            │                              │
│  ┌──────▼────────────▼────────────▼───┐                         │
│  │        Shared Infrastructure        │                         │
│  │  Vault │ Kafka │ Redis │ OTEL      │                         │
│  └────────────────────────────────────┘                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    Data Layer                                    │
│  PostgreSQL (Aurora/Patroni) │ TigerBeetle │ S3/Ceph           │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Option 1: AWS Cloud (Terraform)

```bash
cd terraform/environments/production
terraform init
terraform plan -out=plan.tfplan
terraform apply plan.tfplan

# Get kubeconfig
aws eks update-kubeconfig --name 54bank-production --region af-south-1

# Deploy platform
kubectl apply -f k8s/vault/
kubectl apply -f k8s/external-secrets/
kubectl apply -f k8s/ingress/
kubectl apply -f k8s/dr/
```

### Option 2: OpenStack (Heat + Magnum)

```bash
# Create infrastructure
openstack stack create -t openstack/heat/54bank-stack.yaml \
  -e openstack/heat/params.yaml 54bank-production

# Get kubeconfig
openstack coe cluster config 54bank-production --dir ~/.kube/

# Deploy platform
kubectl apply -f k8s/vault/
kubectl apply -f k8s/external-secrets/
kubectl apply -f k8s/ingress/
kubectl apply -f onpremise/metallb/
kubectl apply -f onpremise/rook-ceph/
```

### Option 3: On-Premise (Ansible + kubeadm)

```bash
# Provision nodes
cd onpremise/ansible
ansible-playbook -i inventory.yaml site.yaml

# Initialize K8s cluster
kubeadm init --config ../kubeadm/cluster-config.yaml

# Join worker nodes
kubeadm join k8s-api.54bank.local:6443 --config ../kubeadm/cluster-config.yaml

# Deploy storage + networking
kubectl apply -f ../metallb/metallb-config.yaml
kubectl apply -f ../rook-ceph/ceph-cluster.yaml

# Deploy platform
kubectl apply -f ../../k8s/vault/
kubectl apply -f ../../k8s/external-secrets/
kubectl apply -f ../../k8s/ingress/
```

## Database Migrations

```bash
# Run migrations for all 512 services
for svc in services/*/; do
  svc_name=$(basename "$svc")
  if [ -d "$svc/migrations" ]; then
    flyway -url=jdbc:postgresql://DB_HOST:5432/$svc_name \
           -locations=filesystem:$svc/migrations \
           migrate
  fi
done
```

## Disaster Recovery

### Failover (Lagos → Abuja)

```bash
# 1. Verify primary is down
pg_isready -h postgres.lagos.54bank.local -p 5432

# 2. Promote Abuja standby
kubectl exec -n database patroni-0 -- patronictl failover

# 3. Update DNS
# Route53/Designate: point api.54bank.ng → Abuja VIP

# 4. Verify
curl https://api.54bank.ng/healthz
```

### Failback (Abuja → Lagos)

```bash
# 1. Rebuild Lagos as standby
kubectl exec -n database patroni-0 -- patronictl reinit 54bank-postgres db-node-1

# 2. Wait for sync
kubectl exec -n database patroni-0 -- patronictl list

# 3. Switchover (zero-downtime)
kubectl exec -n database patroni-0 -- patronictl switchover
```

## Testing

```bash
# Unit tests
make test

# Integration tests
cd tests/integration && go test -v ./...

# E2E tests
cd tests/e2e && pytest -v

# Load tests
k6 run tests/load/k6_banking_load.js --env BASE_URL=https://api.54bank.ng

# Contract tests
cd tests/contract && pytest -v
```

## Monitoring

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| Grafana | https://grafana.54bank.local | Metrics & dashboards |
| Prometheus | https://prometheus.54bank.local | Metrics storage |
| Vault UI | https://vault.54bank.local | Secrets management |
| APISIX Dashboard | https://apisix.54bank.local | API gateway mgmt |
| Ceph Dashboard | https://ceph.54bank.local | Storage monitoring |

## Compliance

| Standard | Document | Status |
|----------|----------|--------|
| PCI-DSS v4.0 | `docs/compliance/PCI-DSS-v4.0-Compliance.md` | 93% (3 external items) |
| NDPR/NDPA | `docs/compliance/NDPR-Compliance.md` | 100% technical controls |
| CBN IT Standards | `docs/compliance/CBN-IT-Standards.md` | 100% technical controls |
