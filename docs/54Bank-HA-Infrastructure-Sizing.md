# 54Bank Platform — High Availability Infrastructure Sizing & Architecture

## Executive Summary

The 54Bank platform comprises **461 microservices** (195 Go, 150 Rust, 80 Python, 36 TypeScript), **14 middleware systems**, **276 database tables**, and **1,054+ API routes**. This document sizes a production-grade HA deployment capable of handling **10,000 concurrent users**, **2,500 TPS peak**, and **99.99% uptime** with zero single points of failure.

The infrastructure is built on two converged platforms:
- **MicroCloud** (Canonical) — IaaS layer providing converged compute, storage (MicroCeph), and networking (MicroOVN) on bare metal
- **Cozystack** — PaaS layer providing managed Kubernetes, databases, tenant isolation, and self-service application deployment via FluxCD

**Total physical servers: 47 (Primary DC) + 28 (DR DC) + 9 (Edge/Branch) = 84 servers**

> MicroCloud's converged architecture reduces the server count from 142 (traditional) to **84** by eliminating dedicated storage, networking, and infrastructure servers — a **41% reduction** in physical hardware while maintaining identical HA guarantees.

---

## 1. Architecture Overview

```
                           ┌─────────────────────────────────────┐
                           │         GLOBAL LOAD BALANCER         │
                           │    (Cloudflare / AWS Global Acc.)    │
                           └──────────┬──────────────┬───────────┘
                                      │              │
              ┌───────────────────────┴──┐    ┌──────┴───────────────────────┐
              │   PRIMARY DC (Lagos)      │    │   DR DATA CENTER (Abuja)     │
              │   MicroCloud Cluster       │    │   MicroCloud Cluster         │
              │   47 physical servers      │    │   28 physical servers        │
              │   ┌─────────────────────┐ │    │   ┌─────────────────────┐   │
              │   │     COZYSTACK       │ │    │   │     COZYSTACK       │   │
              │   │  PaaS / Platform    │ │    │   │  PaaS / Platform    │   │
              │   │  ┌───────────────┐  │ │    │   │  ┌───────────────┐  │   │
              │   │  │ Mgmt K8s      │  │ │    │   │  │ Mgmt K8s      │  │   │
              │   │  │ Tenant K8s(es)│  │ │    │   │  │ Tenant K8s(es)│  │   │
              │   │  │ Managed DBs   │  │ │    │   │  │ Managed DBs   │  │   │
              │   │  │ Managed Apps  │  │ │    │   │  │ Managed Apps  │  │   │
              │   │  └───────────────┘  │ │    │   │  └───────────────┘  │   │
              │   └─────────────────────┘ │    │   └─────────────────────┘   │
              │   ┌─────────────────────┐ │    │   ┌─────────────────────┐   │
              │   │    MICROCLOUD       │ │    │   │    MICROCLOUD       │   │
              │   │  LXD  (Compute)    │ │    │   │  LXD  (Compute)    │   │
              │   │  MicroCeph (Store)  │ │    │   │  MicroCeph (Store)  │   │
              │   │  MicroOVN  (Net)   │ │    │   │  MicroOVN  (Net)   │   │
              │   └─────────────────────┘ │    │   └─────────────────────┘   │
              └──────────────────────────┘    └─────────────────────────────┘
                                                           │
                            ┌──────────────────────────────┘
                            │
              ┌─────────────┴──────────────┐
              │   EDGE / BRANCH NODES       │
              │   MicroCloud Mini-Clusters   │
              │   3-node per site × 3 sites  │
              │   9 physical servers          │
              └────────────────────────────┘
```

### Design Principles
- **No single point of failure** — every component runs 3+ replicas across MicroCloud nodes
- **Converged infrastructure** — MicroCloud eliminates dedicated storage/networking servers
- **Platform-as-a-Service** — Cozystack self-service for managed K8s, Postgres, Kafka, Redis
- **Multi-tenancy** — Cozystack tenant isolation for white-label partners and bank tenants
- **Active-Passive DR** — Abuja DC takes over within 15 minutes (RTO)
- **RPO < 5 minutes** — MicroCeph cross-DC replication + Kafka MirrorMaker
- **CBN compliance** — quarterly DR testing, data residency in Nigeria
- **Edge presence** — MicroCloud 3-node clusters at branch/agent locations

---

## 2. Platform Stack — MicroCloud + Cozystack

### 2.1 Layer 1: MicroCloud (IaaS — Infrastructure as a Service)

MicroCloud provides the **bare-metal foundation** — turning physical servers into a converged cloud with compute, storage, and networking managed as a single unit.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        MICROCLOUD CLUSTER                             │
│                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   Physical       │  │   Physical       │  │   Physical       │  ...│
│  │   Server 1       │  │   Server 2       │  │   Server N       │     │
│  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │     │
│  │  │    LXD     │  │  │  │    LXD     │  │  │  │    LXD     │  │     │
│  │  │ VMs + CTs  │  │  │  │ VMs + CTs  │  │  │  │ VMs + CTs  │  │     │
│  │  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │     │
│  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │     │
│  │  │ MicroCeph  │  │  │  │ MicroCeph  │  │  │  │ MicroCeph  │  │     │
│  │  │ OSD + Mon  │  │  │  │ OSD + Mon  │  │  │  │ OSD + Mon  │  │     │
│  │  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │     │
│  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │     │
│  │  │ MicroOVN   │  │  │  │ MicroOVN   │  │  │  │ MicroOVN   │  │     │
│  │  │ SDN Fabric │  │  │  │ SDN Fabric │  │  │  │ SDN Fabric │  │     │
│  │  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
```

| Component | Technology | Role in 54Bank |
|-----------|-----------|----------------|
| **LXD** | KVM/QEMU VMs + system containers | Runs Talos Linux VMs for Cozystack K8s nodes, plus system containers for legacy workloads |
| **MicroCeph** | Ceph (block/object/file) | Distributed storage — Postgres data, Kafka logs, OpenSearch indices, MinIO backend, TigerBeetle WAL |
| **MicroOVN** | OVN (Open Virtual Networking) | L2/L3 overlays, security groups, DHCP, tenant network isolation, inter-DC tunnels |

#### MicroCloud Benefits for 54Bank
| Traditional Approach | MicroCloud Approach | Savings |
|---------------------|--------------------|---------| 
| 9 dedicated Postgres servers | Postgres VMs on shared MicroCloud nodes, MicroCeph for storage | -4 servers |
| 6 dedicated MinIO servers | MinIO uses MicroCeph object storage directly | -6 servers |
| Dedicated network switches per zone | MicroOVN software-defined VLANs across all nodes | Simplified networking |
| Separate storage SAN/NAS | MicroCeph converged on every node | No dedicated storage infra |
| Manual VM provisioning | `lxc launch` with profiles, instant VM spin-up | Minutes vs hours |

### 2.2 Layer 2: Cozystack (PaaS — Platform as a Service)

Cozystack runs **on top of MicroCloud** VMs, providing a self-service platform for deploying and managing Kubernetes clusters, databases, and applications.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         COZYSTACK PaaS                                │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ Layer 4: Dashboard & API                                      │    │
│  │  OpenAPI UI │ Grafana │ Tenant Portal │ Platform Operator UI  │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ Layer 3: Platform Services (Managed Applications)             │    │
│  │                                                                │    │
│  │  ┌─────────────┐ ┌──────────┐ ┌───────┐ ┌──────────────┐    │    │
│  │  │ Managed      │ │ Managed  │ │ Managed│ │ Managed      │    │    │
│  │  │ Postgres     │ │ Kafka    │ │ Redis  │ │ ClickHouse   │    │    │
│  │  │ (CloudNative │ │ (Strimzi)│ │ (Drg. │ │              │    │    │
│  │  │  PG Operator)│ │          │ │  fly)  │ │              │    │    │
│  │  └─────────────┘ └──────────┘ └───────┘ └──────────────┘    │    │
│  │  ┌─────────────┐ ┌──────────┐ ┌───────┐ ┌──────────────┐    │    │
│  │  │ Managed      │ │ Managed  │ │ Tenant│ │ Managed      │    │    │
│  │  │ Kubernetes   │ │ VMs      │ │ K8s   │ │ OpenSearch   │    │    │
│  │  │ (Cluster API)│ │(KubeVirt)│ │Clusters│ │              │    │    │
│  │  └─────────────┘ └──────────┘ └───────┘ └──────────────┘    │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ Layer 2: Infrastructure Services                              │    │
│  │  FluxCD │ KubeVirt │ DRBD/LINSTOR │ Kube-OVN │ Cilium       │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ Layer 1: OS & Kubernetes                                      │    │
│  │  Talos Linux │ Kubernetes (on LXD VMs from MicroCloud)        │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

| Component | Role in 54Bank |
|-----------|----------------|
| **Talos Linux** | Immutable, minimal OS for K8s nodes — runs inside LXD VMs on MicroCloud |
| **FluxCD** | GitOps deployment — all 461 services deployed declaratively from Git |
| **KubeVirt** | Run VMs inside K8s for legacy banking workloads (ATM simulators, ISO 8583 engines) |
| **DRBD/LINSTOR** | Replicated block storage within K8s — Postgres PVCs, Kafka PVCs with synchronous replication |
| **Kube-OVN** | Virtual network fabric — tenant network isolation, floating IPs for banking endpoints |
| **Cilium** | eBPF networking — high-performance pod networking, network policies, service mesh |
| **Cluster API** | Managed tenant K8s clusters — each white-label partner gets their own isolated cluster |
| **CloudNativePG** | Managed Postgres — automated failover, backup, connection pooling |

#### Cozystack Tenant Model for 54Bank

```
Platform Operator (54Bank)
├── Management Cluster (Cozystack core)
│   ├── FluxCD, cert-manager, monitoring
│   └── Platform operator dashboard
│
├── Tenant: "54Bank Core" (internal)
│   ├── K8s Cluster: banking-prod
│   │   ├── 195 Go services (core banking, payments, channels)
│   │   ├── 150 Rust services (ledger, security, compliance)
│   │   ├── 80 Python services (ML, analytics, workflows)
│   │   └── 36 TypeScript gateways
│   ├── Managed Postgres (276 tables, HA with 3 replicas)
│   ├── Managed Kafka (156 topics)
│   ├── Managed Redis (6-node cluster)
│   └── Managed OpenSearch (audit logs)
│
├── Tenant: "White-Label Partner A" (Platinum tier)
│   ├── K8s Cluster: partner-a-prod
│   │   └── All 8 growth features + full banking stack
│   ├── Managed Postgres (isolated)
│   └── Managed Redis (isolated)
│
├── Tenant: "White-Label Partner B" (Gold tier)
│   ├── K8s Cluster: partner-b-prod
│   │   └── 6 growth features (no investments/remittances)
│   ├── Managed Postgres (isolated)
│   └── Managed Redis (isolated)
│
└── Tenant: "Agent Banking Network"
    ├── K8s Cluster: agents-prod
    │   └── QR payments, chatbot, POS
    └── Managed Postgres (shared, namespace-isolated)
```

---

## 3. Primary Data Center (Lagos) — 47 Physical Servers

### 3.1 MicroCloud Node Allocation

All physical servers run **MicroCloud** (LXD + MicroCeph + MicroOVN). Workloads are deployed as LXD VMs running Talos Linux for Cozystack, or as system containers for infrastructure services.

| Node Class | Count | Specs (each) | Workloads Hosted |
|------------|-------|-------------|-----------------|
| **MC-XL (Compute+Storage Heavy)** | 6 | 2× Xeon 6430 (64c), 256 GB DDR5, 2× 3.84TB NVMe (Ceph OSD) + 2× 1TB NVMe (OS+LXD), 2× 25GbE | Cozystack management cluster, Postgres primaries, TigerBeetle, OpenSearch, ML inference (GPU optional) |
| **MC-L (General Workload)** | 18 | 1× Xeon 6430 (32c), 128 GB DDR5, 2× 1.92TB NVMe (Ceph OSD) + 1× 500GB NVMe (OS), 2× 25GbE | K8s workers (core banking, compliance, agri, channels, infrastructure), Kafka brokers, Temporal |
| **MC-M (Mid-Range)** | 12 | 1× Xeon 6416 (16c), 64 GB DDR5, 2× 960GB NVMe (Ceph OSD) + 1× 500GB NVMe (OS), 2× 10GbE | Redis, Keycloak, APISIX, Permify, Fluvio, monitoring, logging, Vault |
| **MC-S (Infrastructure)** | 8 | 1× Xeon 5416 (8c), 32 GB DDR5, 1× 960GB NVMe (Ceph OSD) + 1× 240GB SSD (OS), 2× 10GbE | HAProxy, WAF, VPN, DNS, CI/CD runners, PgBouncer |
| **MC-NET (Network)** | 3 | 4× 25GbE + 2× 100GbE uplink | Top-of-rack switches (MicroOVN uplinks) |

**Subtotal: 47 physical servers (44 compute + 3 network)**

#### Resource Totals (Primary DC)

| Resource | Total |
|----------|-------|
| Physical cores | 1,056 |
| RAM | 4,736 GB (~4.6 TB) |
| Ceph raw storage | ~96 TB NVMe |
| Ceph usable (3× replication) | ~32 TB |
| Network | 25GbE fabric, 100GbE uplinks |

### 3.2 Virtual Machine Layout (on MicroCloud)

MicroCloud provisions these VMs via LXD. Cozystack runs Talos Linux in each VM.

| VM Pool | VMs | vCPU/VM | RAM/VM | Storage (Ceph PVC) | Purpose |
|---------|-----|---------|--------|-------------------|---------|
| **Cozystack Control Plane** | 3 | 8 | 16 GB | 200 GB | Cozystack management K8s (FluxCD, operators, dashboard) |
| **K8s Worker — Core Banking** | 6 | 24 | 48 GB | 400 GB | 120 services × 2 replicas (loans, deposits, GL, payments) |
| **K8s Worker — Compliance/AML** | 3 | 12 | 24 GB | 200 GB | 50 services × 2 replicas (AML, KYC, sanctions) |
| **K8s Worker — Agriculture** | 3 | 12 | 24 GB | 200 GB | 75 services × 2 replicas (agri-finance, IoT) |
| **K8s Worker — Channels** | 3 | 12 | 24 GB | 200 GB | 50 services × 2 replicas (SMS, USSD, WhatsApp) |
| **K8s Worker — Infrastructure** | 3 | 12 | 24 GB | 200 GB | 80 services × 2 replicas (security, billing, events) |
| **K8s Worker — ML/Analytics** | 3 | 16 | 32 GB | 400 GB | 20 services, GPU passthrough for inference |
| **Tenant K8s Workers** | 6 | 8 | 16 GB | 200 GB | White-label partner isolated clusters |
| **Managed Postgres** | 3 | 16 | 64 GB | 2 TB (Ceph RBD) | CloudNativePG: 1 primary + 2 sync standby |
| **Managed Postgres Read Replicas** | 3 | 8 | 32 GB | 1 TB | Read-only replicas for reports/dashboards |
| **PgBouncer** | 3 | 2 | 4 GB | 20 GB | Connection pooling (10K → 200 backend) |
| **Managed Kafka** | 3 | 12 | 48 GB | 1.5 TB (Ceph RBD) | Strimzi: 3 brokers, 156 topics, KRaft mode |
| **Managed Redis** | 6 | 4 | 16 GB | 100 GB | Dragonfly/Redis: 3 masters + 3 replicas |
| **TigerBeetle** | 3 | 8 | 16 GB | 500 GB | Financial ledger, 3-node consensus |
| **Temporal** | 3+3 | 6 | 12 GB | 200 GB | 3 server + 3 worker VMs, 7 task queues |
| **OpenSearch** | 3 | 12 | 48 GB | 1 TB (Ceph RBD) | Audit logs, full-text search |
| **Keycloak** | 3 | 4 | 8 GB | 100 GB | SSO/OAuth2, 125K users, Infinispan |
| **APISIX** | 3 | 4 | 8 GB | 50 GB | API gateway, rate limiting, WAF |
| **Permify** | 3 | 2 | 4 GB | 50 GB | Fine-grained authorization |
| **Fluvio** | 3 | 4 | 8 GB | 200 GB | Real-time streaming |
| **Monitoring** | 2 | 8 | 32 GB | 1 TB | Prometheus + Grafana (Cozystack-managed) |
| **Logging** | 2 | 8 | 32 GB | 2 TB | Loki/ELK stack |
| **Vault** | 3 | 2 | 4 GB | 100 GB | Secrets management, 3-node Raft |
| **HAProxy** | 2 | 4 | 8 GB | 50 GB | L4/L7 LB, VRRP failover |
| **WAF/Firewall** | 2 | 4 | 8 GB | 50 GB | OpenAppSec, DDoS |
| **VPN** | 1 | 2 | 4 GB | 20 GB | Site-to-site (Lagos ↔ Abuja) |
| **DNS** | 2 | 1 | 2 GB | 10 GB | CoreDNS |
| **CI/CD** | 2 | 8 | 16 GB | 500 GB | Runners, Docker builds |

### 3.3 MicroCeph Storage Pools

| Pool | Type | Replication | Size | Usage |
|------|------|------------|------|-------|
| **ssd-replicated** | NVMe RBD | 3× | 32 TB usable | Postgres data, TigerBeetle WAL, Kafka logs |
| **ssd-ec** | NVMe RBD (erasure coded 4+2) | EC 4+2 | 48 TB usable | OpenSearch indices, logs, backups, MinIO objects |
| **cephfs-shared** | CephFS | 3× | 8 TB usable | Shared config, Helm charts, FluxCD state |

### 3.4 MicroOVN Network Layout

| Network | CIDR | Purpose | Isolation |
|---------|------|---------|-----------|
| **mgmt** | 10.0.0.0/24 | MicroCloud management, LXD API | Physical VLAN 10 |
| **cozystack-internal** | 10.1.0.0/16 | Cozystack management K8s pod/service CIDR | OVN overlay |
| **banking-prod** | 10.2.0.0/16 | Core banking tenant pod/service CIDR | OVN overlay, isolated |
| **partner-a** | 10.3.0.0/16 | White-label partner A (fully isolated) | OVN overlay, isolated |
| **partner-b** | 10.4.0.0/16 | White-label partner B (fully isolated) | OVN overlay, isolated |
| **middleware** | 10.5.0.0/16 | Kafka, Redis, Postgres, OpenSearch | OVN overlay |
| **dmz** | 172.16.0.0/24 | Public-facing: HAProxy, APISIX, WAF | OVN + floating IPs |
| **replication** | 192.168.100.0/24 | Ceph replication, Postgres WAL, Kafka MirrorMaker | Dedicated VLAN 60 |
| **ceph-cluster** | 192.168.200.0/24 | MicroCeph OSD-to-OSD traffic | Dedicated VLAN 70 |

---

## 4. DR Data Center (Abuja) — 28 Physical Servers

Active-passive with 60% capacity, designed to handle full load on failover.

| Node Class | Primary | DR | Notes |
|------------|---------|-----|-------|
| MC-XL | 6 | 4 | Postgres, TigerBeetle, OpenSearch (full parity for financial data) |
| MC-L | 18 | 10 | K8s workers (1 replica per service, auto-scale on failover) |
| MC-M | 12 | 7 | Redis, Keycloak, Temporal, monitoring |
| MC-S | 8 | 5 | HAProxy, WAF, DNS, VPN |
| MC-NET | 3 | 2 | Network switches |
| **Total** | **47** | **28** | |

#### DR Replication

| Component | Replication Method | RPO |
|-----------|-------------------|-----|
| Postgres | Streaming replication (async to Abuja) | < 5 min |
| MicroCeph | RBD mirroring (image-level) | < 5 min |
| Kafka | MirrorMaker 2.0 (topic-level) | < 2 min |
| TigerBeetle | Native 3-node replication (cross-DC member) | < 1 min |
| Redis | Cross-DC replica with WAIT | < 30 sec |
| OpenSearch | Cross-cluster replication (CCR) | < 10 min |
| Vault | Raft snapshot replication | < 5 min |
| Cozystack | FluxCD GitOps (same Git repo) | Instant (Git push) |

---

## 5. Edge / Branch MicroCloud Clusters — 9 Servers (3 sites × 3 nodes)

For **agent banking**, **branch operations**, and **rural agriculture** services, MicroCloud deploys lightweight 3-node clusters at edge locations.

### Edge Cluster Spec (per site)

| Server | Spec | Count |
|--------|------|-------|
| **MC-Edge** | 1× Xeon D-2776NT (16c), 64 GB DDR5, 2× 960GB NVMe (Ceph), 2× 10GbE | 3 |

### Edge Services Deployed

| Service | Purpose |
|---------|---------|
| Agent banking POS gateway | QR payments, cash-in/cash-out |
| USSD gateway | Feature phone banking (local processing) |
| Offline-first sync engine | Queue transactions when WAN is down, sync when up |
| Branch teller system | Deposits, withdrawals, account opening |
| Local Postgres | Branch-local data with async replication to Lagos |
| Redis (cache) | Session management, rate limiting |

### Edge Sizing
| Metric | Per Site | 3 Sites |
|--------|---------|---------|
| Physical servers | 3 | 9 |
| vCPU | 48 | 144 |
| RAM | 192 GB | 576 GB |
| Storage (usable) | 640 GB | 1.92 TB |
| Services | 6 (containerized) | 18 |

### Edge ↔ Core Sync
```
Edge MicroCloud (Branch)
    │
    ├── WAN link (10-100 Mbps)
    │
    ├── Transaction queue (Kafka Connect)
    │   └── Async replication to Lagos Kafka cluster
    │
    ├── Postgres logical replication
    │   └── Branch tables → Lagos primary (async)
    │
    └── MicroCeph RBD mirroring (nightly)
        └── Full data backup to Lagos Ceph
```

---

## 6. Total Server Summary

```
┌──────────────────────────────────────────────────────────────┐
│              TOTAL: 84 PHYSICAL SERVERS                       │
│         (vs 142 traditional — 41% reduction)                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  PRIMARY DC (Lagos)    DR DC (Abuja)     EDGE (3 sites)     │
│  ═══════════════════  ═══════════════   ═══════════════     │
│  47 servers            28 servers        9 servers           │
│  ~1,056 cores          ~624 cores        ~144 cores          │
│  ~4,736 GB RAM         ~2,816 GB RAM     ~576 GB RAM         │
│  ~96 TB raw NVMe       ~56 TB raw NVMe   ~5.8 TB raw NVMe   │
│                                                              │
│  COMBINED TOTALS:                                            │
│  ─────────────────                                           │
│  Physical Cores: ~1,824                                      │
│  RAM:            ~8,128 GB (~8 TB)                           │
│  Raw Storage:    ~158 TB NVMe                                │
│  Usable Storage: ~53 TB (3× replication)                     │
│  Network:        25GbE fabric, 100GbE uplinks, 10Gbps WAN   │
│                                                              │
│  STACK:                                                      │
│  ──────                                                      │
│  IaaS:  MicroCloud (LXD + MicroCeph + MicroOVN)             │
│  PaaS:  Cozystack (Talos + FluxCD + KubeVirt + Cilium)      │
│  Apps:  461 microservices + 14 middleware systems             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Capacity Planning

### 7.1 Performance Targets

| Metric | Target | Architecture Support |
|--------|--------|---------------------|
| Peak TPS | 2,500 | 461 services × 2 replicas, APISIX LB, Cozystack auto-scaling |
| Concurrent Users | 10,000 | PgBouncer pooling, Redis session cache |
| API Latency (p99) | < 500ms | Redis caching, Postgres read replicas, Cilium eBPF |
| Availability | 99.99% | MicroCloud HA + Cozystack managed failover + DR site |
| RTO | < 15 min | CloudNativePG auto-failover, K8s rescheduling, MicroCloud live migration |
| RPO | < 5 min | MicroCeph RBD mirroring, Postgres streaming replication |
| Storage Growth | ~50 GB/month | MicroCeph elastic expansion (add OSD) |
| Backup Window | < 30 min | pg_basebackup + MicroCeph snapshots to DR |

### 7.2 Scaling Thresholds (MicroCloud + Cozystack)

| Trigger | Action | How |
|---------|--------|-----|
| CPU > 70% sustained | Add MicroCloud node | Rack new server → `microcloud add` → auto-joins Ceph + OVN |
| Postgres connections > 80% | Add read replica | Cozystack dashboard: deploy new Postgres replica (2 clicks) |
| Kafka lag > 10,000 | Add broker | Strimzi operator: increase `replicas` in Kafka CR |
| Storage > 70% | Add Ceph OSD | Rack NVMe drive → `microceph disk add` → pool auto-expands |
| New white-label partner | Provision tenant | Cozystack: create tenant → deploys isolated K8s + Postgres + Redis |
| New branch location | Deploy edge cluster | 3 servers → `microcloud init` → deploy edge services via FluxCD |

---

## 8. Network Architecture

```
                    INTERNET
                       │
                ┌──────┴──────┐
                │  Cloudflare  │  DDoS protection, CDN, WAF
                │  (Global)    │  SSL termination
                └──────┬──────┘
                       │
          ┌────────────┴────────────┐
          │                         │
    ┌─────┴──────────┐       ┌─────┴──────────┐
    │  Lagos DC       │       │  Abuja DC       │
    │  MicroCloud     │       │  MicroCloud     │
    │  47 servers     │◄─────►│  28 servers     │
    │                 │10Gbps │                 │
    └─────┬──────────┘ MPLS  └─────┬──────────┘
          │                         │
    ┌─────┴──────────────┐          │
    │  MicroOVN Overlay   │          │
    │                     │          │
    │  ┌────────────┐    │          │
    │  │ DMZ Network │    │    ┌────┴─────────┐
    │  │ HAProxy+WAF │    │    │ Edge Sites   │
    │  └─────┬──────┘    │    │ 3×3 servers  │
    │        │            │    │ MicroCloud   │
    │  ┌─────┴──────┐    │    │ mini-clusters │
    │  │ APISIX GW  │    │    └──────────────┘
    │  │ (L7 route) │    │
    │  └─────┬──────┘    │
    │        │            │
    │  ┌─────┴───────────────────────────┐
    │  │    Cozystack Tenant Networks     │
    │  │                                  │
    │  │  ┌──────────┐  ┌──────────┐    │
    │  │  │ banking- │  │ partner- │    │
    │  │  │ prod     │  │ a-prod   │    │
    │  │  │ 10.2/16  │  │ 10.3/16  │    │
    │  │  └──────────┘  └──────────┘    │
    │  │  ┌──────────┐  ┌──────────┐    │
    │  │  │ partner- │  │ agents-  │    │
    │  │  │ b-prod   │  │ prod     │    │
    │  │  │ 10.4/16  │  │ 10.6/16  │    │
    │  │  └──────────┘  └──────────┘    │
    │  └─────────────────────────────────┘
    │        │
    │  ┌─────┴──────────┐
    │  │ Middleware Net  │
    │  │ Kafka│Redis│PG  │
    │  │ 10.5.0.0/16    │
    │  └────────────────┘
    │        │
    │  ┌─────┴──────────┐
    │  │ Ceph Cluster    │
    │  │ 192.168.200/24  │
    │  └────────────────┘
    └─────────────────────┘
```

---

## 9. Server Specifications Summary

### Physical Server Classes (MicroCloud Nodes)

| Class | CPU | RAM | Storage | NIC | Count (All DCs) | Use |
|-------|-----|-----|---------|-----|-----------------|-----|
| **MC-XL** | 2× Xeon 6430 (64c) | 256 GB DDR5 | 2× 3.84TB + 2× 1TB NVMe | 2× 25GbE | 10 | DB primaries, TigerBeetle, OpenSearch, ML |
| **MC-L** | 1× Xeon 6430 (32c) | 128 GB DDR5 | 2× 1.92TB + 1× 500GB NVMe | 2× 25GbE | 28 | K8s workers, Kafka, Temporal |
| **MC-M** | 1× Xeon 6416 (16c) | 64 GB DDR5 | 2× 960GB + 1× 500GB NVMe | 2× 10GbE | 19 | Redis, Keycloak, APISIX, monitoring |
| **MC-S** | 1× Xeon 5416 (8c) | 32 GB DDR5 | 1× 960GB + 1× 240GB SSD | 2× 10GbE | 13 | HAProxy, WAF, DNS, VPN, CI/CD |
| **MC-Edge** | 1× Xeon D-2776NT (16c) | 64 GB DDR5 | 2× 960GB NVMe | 2× 10GbE | 9 | Branch/agent edge clusters |
| **MC-NET** | — | — | — | 4× 25GbE + 2× 100GbE | 5 | ToR switches |

---

## 10. Cost Estimate (Annual)

### On-Premise with MicroCloud + Cozystack (Lagos + Abuja + Edge)

| Item | Monthly (₦) | Annual (₦) | Annual (USD @₦1,550) |
|------|------------|-----------|---------------------|
| **Hardware (84 servers, amortized 5yr)** | 28,000,000 | 336,000,000 | $216,774 |
| **Colocation (2 DCs + 3 edge, power, cooling)** | 12,000,000 | 144,000,000 | $92,903 |
| **Network (10Gbps inter-DC, WAN to edge)** | 6,000,000 | 72,000,000 | $46,452 |
| **Licenses (Cozystack Enterprise, Canonical UA)** | 4,000,000 | 48,000,000 | $30,968 |
| **Support & Maintenance** | 4,000,000 | 48,000,000 | $30,968 |
| **DevOps Team (4 engineers — reduced by automation)** | 10,000,000 | 120,000,000 | $77,419 |
| **DR Testing (quarterly)** | 800,000 | 9,600,000 | $6,194 |
| **TOTAL** | **64,800,000** | **777,600,000** | **$501,677** |

### Cost Comparison

| Approach | Servers | Annual Cost (USD) | Savings vs Traditional |
|----------|---------|------------------|----------------------|
| **Traditional (dedicated servers)** | 142 | $692,903 | — |
| **MicroCloud + Cozystack** | 84 | $501,677 | **-28% ($191K/yr)** |
| **Cloud (AWS)** | N/A | $600,000 | -13% |

### Why MicroCloud + Cozystack Saves Money
1. **41% fewer servers** — converged compute/storage/networking eliminates dedicated infrastructure
2. **1 fewer DevOps engineer** — Cozystack self-service reduces operational burden
3. **Lower colocation** — fewer racks, less power, less cooling
4. **Edge at minimal cost** — 3-node MicroCloud clusters vs dedicated branch servers
5. **No storage SAN** — MicroCeph replaces dedicated storage arrays

---

## 11. Deployment Strategy

### Phase 1 — MicroCloud Foundation (Week 1-2)
- Rack 10 MC-XL + MC-L servers in Lagos
- `sudo snap install microcloud lxd microceph microovn`
- `microcloud init` — creates converged cluster
- Configure MicroCeph storage pools (ssd-replicated, ssd-ec)
- Configure MicroOVN networks (mgmt, cozystack-internal, dmz)
- **Result: MicroCloud cluster operational**

### Phase 2 — Cozystack PaaS (Week 3-4)
- Deploy 3 Talos Linux VMs (via LXD) for Cozystack management cluster
- Install Cozystack: `talosctl` bootstrap → FluxCD → platform components
- Deploy DRBD/LINSTOR for in-cluster storage
- Deploy Kube-OVN + Cilium networking
- Enable Cozystack dashboard
- **Result: PaaS operational, ready for workloads**

### Phase 3 — Core Banking Deployment (Month 2)
- Create "54Bank Core" tenant in Cozystack
- Deploy managed Postgres (CloudNativePG, 3 replicas)
- Deploy managed Kafka (Strimzi, 3 brokers)
- Deploy managed Redis (6 nodes)
- Deploy 461 microservices via FluxCD GitOps
- Deploy APISIX, Keycloak, TigerBeetle, Temporal, OpenSearch
- **Result: Full banking platform operational**

### Phase 4 — Remaining Primary + DR (Month 3-4)
- Rack remaining MC-M + MC-S servers in Lagos
- Deploy monitoring, logging, Vault, CI/CD
- Rack 28 servers in Abuja → `microcloud init`
- Deploy Cozystack on Abuja → configure cross-DC replication
- DR testing and failover validation
- **Result: Full HA with DR**

### Phase 5 — Edge Deployment (Month 5)
- Ship 3× MC-Edge servers to each branch location
- `microcloud init` at each site (3-node cluster)
- Deploy edge services via FluxCD (same GitOps repo)
- Configure WAN sync to Lagos
- **Result: Edge/branch presence operational**

---

## 12. Monitoring & Alerting

| Alert | Threshold | Action |
|-------|-----------|--------|
| MicroCloud node offline | Any node down | MicroCloud auto-migrates VMs, alert DevOps |
| MicroCeph OSD down | < 3 replicas healthy | Alert + auto-recovery (Ceph self-heals) |
| Cozystack managed DB failover | Primary unreachable | CloudNativePG promotes standby (automatic) |
| Service pod crash | > 2 restarts in 5 min | PagerDuty → on-call engineer |
| Postgres replication lag | > 30 seconds | Alert + investigate |
| Kafka consumer lag | > 10,000 messages | Scale consumers via Strimzi |
| MicroCeph storage > 70% | Alert | Add NVMe drive: `microceph disk add` |
| Edge cluster WAN down | > 5 min disconnected | Edge goes offline-first, alert NOC |
| Cozystack tenant resource quota | > 80% | Alert tenant admin, suggest upgrade |
| DR replication broken | Any interruption | Immediate alert + manual investigation |
| Certificate expiry | < 14 days | cert-manager auto-renew |
| Memory usage | > 85% | Scale pods or add MicroCloud node |

---

## 13. Operational Advantages

### MicroCloud
| Capability | Operational Impact |
|-----------|-------------------|
| `microcloud add <server>` | New server joins cluster in minutes — compute + storage + networking auto-configured |
| LXD live migration | Move running VMs between physical servers for maintenance — zero downtime |
| MicroCeph auto-rebalancing | Add/remove disks, data redistributes automatically |
| MicroOVN overlay networking | No physical network reconfiguration for new tenants |
| Unified CLI (`lxc`, `microceph`, `microovn`) | Single toolchain for all infrastructure operations |
| Snap-based updates | OS-level updates with rollback capability |

### Cozystack
| Capability | Operational Impact |
|-----------|-------------------|
| FluxCD GitOps | All deployments from Git — auditable, reproducible, rollback via `git revert` |
| Self-service tenant K8s | White-label partners get isolated clusters in minutes |
| Managed Postgres (CloudNativePG) | Automated failover, backup, point-in-time recovery |
| Managed Kafka (Strimzi) | Broker scaling, topic management, monitoring built-in |
| KubeVirt VMs | Run legacy banking workloads (ATM sims, ISO 8583) alongside containers |
| Cozystack dashboard | Platform operator UI for provisioning, monitoring, tenant management |
| DRBD/LINSTOR storage | Synchronous block replication within K8s — faster than Ceph for latency-critical DBs |
| Cilium eBPF | Wire-speed network policies, no iptables overhead |

---

*Document Version: 2.0 | Generated: 2026-05-13 | Platform: 54Bank v2.0*
*Infrastructure: MicroCloud (LXD + MicroCeph + MicroOVN) + Cozystack (Talos + FluxCD + KubeVirt + Cilium)*
*461 services | 14 middleware | 276 tables | 84 physical servers for 99.99% HA*
