---
name: testing-infrastructure
description: Test 54Bank infrastructure-as-code configs (Terraform, OpenStack Heat, On-Premise K8s, K8s manifests, compliance docs). Use when verifying IaC changes, deployment config updates, or compliance documentation.
---

# Testing 54Bank Infrastructure Configs

## Prerequisites

- Python 3.12+ with `pyyaml` package (for YAML validation)
- No Terraform CLI, Ansible, or OpenStack CLI needed — all validation is structural
- Go 1.21+, Rust/Cargo, Python 3.12+ (for service compilation spot-checks)

## Devin Secrets Needed

None — all testing is local structural validation.

## Key Gotcha: Multi-Document YAML

K8s manifest files use `---` separators for multiple resources in one file. You MUST use `yaml.safe_load_all()` (not `yaml.safe_load()`) to parse them. Expected document counts:

| File | Docs |
|------|------|
| `k8s/vault/vault-deployment.yaml` | 8 |
| `k8s/crossplane/hybrid-cloud.yaml` | 11 |
| `k8s/external-secrets/external-secrets-operator.yaml` | 9 |
| `k8s/ingress/apisix-gateway.yaml` | 7 |
| `k8s/dr/disaster-recovery.yaml` | 5 |
| `onpremise/rook-ceph/ceph-cluster.yaml` | 6 |
| `onpremise/metallb/metallb-config.yaml` | 6 |
| `onpremise/kubeadm/cluster-config.yaml` | 4 |

Single-doc files: `audit-policy.yaml`, `encryption-config.yaml`, `site.yaml`, `inventory.yaml`, `54bank-stack.yaml`, `cluster-template.yaml`.

## Step 1: YAML Syntax Validation

```bash
cd /home/ubuntu/repos/corebanking
python3 -c "
import yaml
files = [
    'k8s/vault/vault-deployment.yaml',
    'k8s/dr/disaster-recovery.yaml',
    'k8s/external-secrets/external-secrets-operator.yaml',
    'k8s/ingress/apisix-gateway.yaml',
    'k8s/crossplane/hybrid-cloud.yaml',
    'onpremise/kubeadm/cluster-config.yaml',
    'onpremise/kubeadm/audit-policy.yaml',
    'onpremise/kubeadm/encryption-config.yaml',
    'onpremise/metallb/metallb-config.yaml',
    'onpremise/rook-ceph/ceph-cluster.yaml',
    'onpremise/ansible/site.yaml',
    'onpremise/ansible/inventory.yaml',
    'openstack/heat/54bank-stack.yaml',
    'openstack/magnum/cluster-template.yaml',
]
for f in files:
    docs = [d for d in yaml.safe_load_all(open(f)) if d is not None]
    print(f'OK  {f} ({len(docs)} docs)')
"
```

**Expected**: All 14 files parse without exceptions.

## Step 2: Terraform HCL Structural Validation

No `terraform` CLI available in the environment. Validate structurally:

```bash
python3 -c "
import os
for root, dirs, files in os.walk('terraform'):
    for f in files:
        if f.endswith('.tf'):
            path = os.path.join(root, f)
            content = open(path).read()
            if content.count('{') != content.count('}'):
                print(f'ERR {path}: unbalanced braces')
            else:
                print(f'OK  {path}')
"
```

**Key assertions**:
- `terraform/environments/production/main.tf` contains: `module "vpc"`, `module "eks"`, `module "rds"`, `module "elasticache"`, `module "msk"`
- `terraform/environments/production/dr.tf` contains: VPC peering, DR EKS/RDS modules
- All 6 module directories have `output` blocks
- At least 4 `aws_kms_key` references (encryption at rest for EKS, RDS, MSK, S3)

## Step 3: OpenStack Heat Template

```bash
python3 -c "
import yaml
doc = yaml.safe_load(open('openstack/heat/54bank-stack.yaml'))
print('version:', doc.get('heat_template_version'))
print('resources:', sorted(doc.get('resources', {}).keys()))
print('params:', sorted(doc.get('parameters', {}).keys()))
"
```

**Key assertions**:
- `heat_template_version` is `2021-04-16`
- Resources include: `internal_network`, `k8s_cluster`, `postgres_cluster`, `api_loadbalancer` (note: NOT `load_balancer` — uses `api_` prefix)
- Parameters include: `cluster_name`, `key_name`, `external_network`

## Step 4: On-Premise Security Checks

```bash
# Encryption at rest
grep -c 'aescbc' onpremise/kubeadm/encryption-config.yaml

# Audit policy covers secrets + RBAC
grep -c 'secrets' onpremise/kubeadm/audit-policy.yaml

# MetalLB IP pools
grep -c 'IPAddressPool' onpremise/metallb/metallb-config.yaml

# Ceph 3+ mons
grep 'count:' onpremise/rook-ceph/ceph-cluster.yaml

# HAProxy TLS 1.2+ and rate limiting
grep 'TLSv1.2' onpremise/haproxy/haproxy.cfg
grep 'stick-table' onpremise/haproxy/haproxy.cfg

# Both sites (Lagos + Abuja DR)
grep -i 'lagos\|abuja' onpremise/ansible/inventory.yaml
```

## Step 5: K8s Manifest Content Validation

Parse YAML and check specific values:
- **Vault**: StatefulSet `replicas: 3`, Raft storage, audit logging
- **APISIX**: Deployment `replicas: 3`, etcd StatefulSet `replicas: 3`
- **External Secrets**: ClusterSecretStore references `vault`
- **DR ConfigMap**: `rto_minutes: 15`, `rpo_minutes: 1`

## Step 6: Service Compilation Spot-Check

Sample 15 Go + 10 Rust + 10 Python services randomly:

```bash
# Go
ls -d services/*-go/ | shuf -n 15 | while read svc; do
  cd /home/ubuntu/repos/corebanking/$svc && go build ./... && go test ./... && echo "PASS $(basename $svc)"
  cd /home/ubuntu/repos/corebanking
done

# Rust (takes ~10-15s each)
ls -d services/*-rs/ | shuf -n 10 | while read svc; do
  cd /home/ubuntu/repos/corebanking/$svc && cargo check && echo "PASS $(basename $svc)"
  cd /home/ubuntu/repos/corebanking
done

# Python
ls -d services/*-py/ | shuf -n 10 | while read svc; do
  cd /home/ubuntu/repos/corebanking/$svc && python3 -m py_compile main.py && python3 -m pytest test_main.py -x -q && echo "PASS $(basename $svc)"
  cd /home/ubuntu/repos/corebanking
done
```

## Step 7: Compliance Docs

- `docs/compliance/PCI-DSS-v4.0-Compliance.md`: Check for "Requirement 1" through "Requirement 12"
- `docs/compliance/NDPR-Compliance.md`: Check for "data residency" and "72 hour" breach notification
- `docs/compliance/CBN-IT-Standards.md`: Check for "RTO" and "RPO" values (should be 15min / 1min)

## Testing Tips

- This is all shell-only testing — do NOT start a recording
- Rust `cargo check` can be slow on first run (compiling dependencies) — allow 15-30s per service
- The Rust compilation might fail due to disk space if many services are checked sequentially — monitor with `df -h`
- Go and Python tests are fast (<1s each)
- ML inference server testing is covered by the `testing-ml-pipeline` skill
