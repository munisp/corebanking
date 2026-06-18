# Proxmox + Cozystack vs MicroCloud + Cozystack — Detailed Comparison

## For 54Bank: 461 services, 14 middleware, 276 tables, 2 DCs + edge

---

## 1. Cost Comparison

### Hardware — Proxmox Needs Slightly More Servers

Both use Ceph for storage, but Proxmox's KVM hypervisor has marginally higher overhead than LXD, and Proxmox lacks the tight OVN integration that lets MicroCloud converge networking onto compute nodes as efficiently.

| Item | MicroCloud + Cozystack | Proxmox + Cozystack | Difference |
|------|----------------------|--------------------|-----------| 
| **Physical servers (Primary)** | 47 | 50 | +3 (Proxmox needs dedicated Ceph monitors at scale) |
| **Physical servers (DR)** | 28 | 30 | +2 |
| **Physical servers (Edge)** | 9 | 9 | Same |
| **Total physical servers** | **84** | **89** | **+5 (+6%)** |

### Licensing & Support

| Item | MicroCloud + Cozystack | Proxmox + Cozystack |
|------|----------------------|--------------------|
| **IaaS software** | Free (Apache 2.0). Enterprise support via Ubuntu Pro | Free (AGPL-3.0). Enterprise repo via Proxmox subscription |
| **IaaS support cost** | Ubuntu Pro with Full Support: **$3,400/server/yr** (includes LXD, MicroCeph, MicroOVN, Landscape, kernel livepatch, FIPS) | Proxmox Standard: **€550/CPU socket/yr** (~$600). Premium: €1,100/socket/yr (~$1,200) |
| **PaaS (Cozystack)** | Same for both — Apache 2.0, Ænix enterprise support if needed |
| **Can run without paying?** | Yes (community snaps, no enterprise repo restriction) | Yes (no-subscription repo, but nag popup on login + delayed security patches) |

#### Support Cost Breakdown (89 servers, Standard tier)

| | MicroCloud (Ubuntu Pro Full) | Proxmox (Standard) |
|--|------------------------------|-------------------|
| Per-server cost | $3,400/yr | ~$600–1,200/socket/yr |
| Typical sockets (84-89 servers) | 84 servers × 1 sub = **$285,600/yr** | ~95 sockets × €550 = **€52,250/yr (~$57,000/yr)** |
| What's included | 24/7 support, kernel livepatch, FIPS, Landscape, 10yr security | Enterprise repo, 10 tickets/yr, 4hr response |
| Without support (community) | $0 (community snaps work fine) | $0 (no-subscription repo, nag on login) |

> **Key insight:** Proxmox licensing is **dramatically cheaper** — €550/socket vs $3,400/server. For a banking platform that needs enterprise support, Proxmox saves ~$228K/yr on support costs alone. However, you can also run MicroCloud without Ubuntu Pro (community snaps are fully functional).

### Total Annual Cost Comparison

| Cost Category | MicroCloud + Cozystack (84 servers) | Proxmox + Cozystack (89 servers) |
|--------------|-------------------------------------|----------------------------------|
| **Hardware (amortized 5yr)** | ₦336M ($217K) | ₦352M ($227K) |
| **Colocation (2 DC + edge)** | ₦144M ($93K) | ₦150M ($97K) |
| **Network** | ₦72M ($46K) | ₦72M ($46K) |
| **IaaS support (Standard)** | ₦0–443M ($0–286K) | ₦88M ($57K) |
| **Cozystack support** | ₦31M ($20K) | ₦31M ($20K) |
| **DevOps team (4 engineers)** | ₦120M ($77K) | ₦120M ($77K) |
| **DR testing** | ₦10M ($6K) | ₦10M ($6K) |
| **TOTAL (with enterprise support)** | **₦1,156M ($746K)** | **₦823M ($531K)** |
| **TOTAL (community/no support)** | **₦713M ($460K)** | **₦735M ($474K)** |

| Scenario | Winner | Savings |
|----------|--------|---------|
| **With enterprise support** | **Proxmox** | **$215K/yr cheaper** (Proxmox support is far less expensive) |
| **Without enterprise support** | **MicroCloud** | **$14K/yr cheaper** (5 fewer servers) |
| **Compromise (Proxmox Standard + Ubuntu Pro self-support)** | **Proxmox** | ~$70K/yr cheaper |

---

## 2. Performance Comparison

### Virtualization Overhead

| Metric | MicroCloud (LXD) | Proxmox (KVM) | Impact |
|--------|-----------------|---------------|--------|
| **Hypervisor type** | LXD: system containers (near-native) + KVM VMs | KVM VMs + LXC containers | MicroCloud defaults to containers (faster), Proxmox defaults to VMs |
| **VM boot time** | ~3-5 seconds (container), ~15-30 sec (VM) | ~15-30 seconds (VM), ~2-5 sec (LXC) | Similar when both use VMs for Cozystack/Talos |
| **CPU overhead** | <1% (containers), ~2-5% (KVM via LXD) | ~2-5% (KVM) | **Negligible difference** — both use KVM for VMs |
| **Memory overhead** | ~50-100 MB per container, ~200-500 MB per VM | ~200-500 MB per VM | MicroCloud wins if using LXD containers; equal for VMs |
| **Network latency (overlay)** | MicroOVN (OVN): ~15-30μs per hop | OVS/Linux bridge: ~10-20μs per hop; SDN (EVPN): ~20-40μs | **Similar** — OVN adds slight overhead vs raw bridge, but gains tenant isolation |

### Storage Performance (Both Use Ceph)

Both platforms use Ceph as the distributed storage backend. Performance is **identical** because:
- Same Ceph version (Reef/Squid)
- Same CRUSH maps, replication, erasure coding
- Same OSD daemon performance

| Metric | MicroCloud (MicroCeph) | Proxmox (Built-in Ceph) | Notes |
|--------|----------------------|------------------------|-------|
| **Ceph integration** | MicroCeph (snap-based, simplified) | Native (apt packages, deeply integrated in UI) | Proxmox Ceph is more mature and configurable |
| **Ceph tuning** | Basic via MicroCeph CLI | Extensive via Proxmox UI + CLI (OSD flags, CRUSH rules, cache tiering) | **Proxmox wins** — more knobs to turn |
| **Sequential write (3-node, NVMe)** | ~2,000-3,000 MB/s | ~2,000-3,000 MB/s | Same Ceph engine |
| **Sequential read** | ~3,000-5,000 MB/s | ~3,000-5,000 MB/s | Same |
| **Random 4K IOPS (write)** | ~50K-80K | ~50K-80K | Same |
| **Random 4K IOPS (read)** | ~100K-150K | ~100K-150K | Same |
| **ZFS option** | No (MicroCeph only) | **Yes** — ZFS for local high-performance storage | **Proxmox wins** — ZFS local pools for latency-critical DBs |
| **Postgres recommendation** | Ceph RBD (replication handles HA) | **ZFS local + Patroni replication** (lower latency) or Ceph RBD | Proxmox gives you the choice |

> **Key insight:** Storage performance is identical when both use Ceph. But Proxmox gives you **ZFS as an additional option** — for latency-critical workloads like Postgres and TigerBeetle, a ZFS local mirror with Patroni replication can deliver 2-3x lower write latency than Ceph RBD.

### Banking Workload Performance Projections

| Workload | MicroCloud + Cozystack | Proxmox + Cozystack | Winner |
|----------|----------------------|--------------------|---------| 
| **API gateway (APISIX)** | ~50K req/s per pod | ~50K req/s per pod | Tie (CPU-bound, not storage) |
| **Postgres (OLTP, 276 tables)** | Ceph RBD: ~8K TPS | ZFS local: ~15K TPS, Ceph RBD: ~8K TPS | **Proxmox** (ZFS option for primary DB) |
| **Kafka throughput** | ~200 MB/s per broker | ~200 MB/s per broker | Tie (sequential I/O, Ceph is fine) |
| **Redis latency** | ~0.1ms (memory-only) | ~0.1ms (memory-only) | Tie (RAM-based) |
| **TigerBeetle (ledger writes)** | Ceph RBD: ~80K transfers/s | ZFS: ~120K transfers/s | **Proxmox** (ZFS for latency-sensitive ledger) |
| **ML inference (GPU)** | LXD GPU passthrough | KVM GPU passthrough | Tie |
| **Live migration speed** | LXD: fast (esp. containers) | KVM: standard QEMU migration | **MicroCloud** (container migration is near-instant) |

### Performance Summary

| Category | MicroCloud | Proxmox | Verdict |
|----------|-----------|---------|---------|
| **Compute** | Equal (both KVM for VMs) | Equal | **Tie** |
| **Storage (Ceph)** | Equal | Equal | **Tie** |
| **Storage (local)** | No ZFS option | **ZFS available** | **Proxmox** |
| **Postgres OLTP** | Good (Ceph RBD) | **Better** (ZFS option) | **Proxmox** |
| **Network overlay** | OVN (good isolation) | OVS/SDN (flexible) | **Tie** |
| **Container workloads** | **Faster** (LXD native) | Good (LXC) | **MicroCloud** |
| **VM workloads** | Equal (KVM) | Equal (KVM) | **Tie** |
| **Live migration** | **Faster** (container) | Standard (VM) | **MicroCloud** |

---

## 3. Manageability Comparison

### Day-0: Initial Setup

| Task | MicroCloud | Proxmox | Winner |
|------|-----------|---------|--------|
| **Install** | `snap install microcloud lxd microceph microovn` on Ubuntu | Boot from ISO, web installer | **MicroCloud** (no ISO needed, runs on existing Ubuntu) |
| **Cluster init** | `microcloud init` — interactive wizard, auto-discovers peers, configures Ceph+OVN in one command | Add nodes via web UI one-by-one, configure Ceph pool manually, configure networking separately | **MicroCloud** (single command does everything) |
| **Time to first VM** | ~15 minutes (cluster init + `lxc launch`) | ~30 minutes (install + cluster + storage + network + create VM) | **MicroCloud** |
| **Cozystack deployment** | Deploy Talos VMs via LXD, bootstrap Cozystack | Deploy Talos VMs via Proxmox, bootstrap Cozystack | **Tie** (Cozystack step is identical) |
| **Ceph setup** | Automatic during `microcloud init` (picks disks) | Manual via UI: create OSD, create pool, set rules | **MicroCloud** |
| **Network setup** | MicroOVN automatic during init (overlay networks) | Manual: create Linux bridge, OVS bridge, or SDN zone | **MicroCloud** |

> **Day-0 winner: MicroCloud** — a single `microcloud init` creates a fully converged cluster. Proxmox requires multiple manual steps across compute, storage, and networking.

### Day-1: Deploying Workloads

| Task | MicroCloud | Proxmox | Winner |
|------|-----------|---------|--------|
| **Create VM** | `lxc launch ubuntu:24.04 myvm --vm` or API | Web UI: Create VM wizard (click-through) | Proxmox (GUI more intuitive for operators) |
| **VM templates** | LXD profiles (YAML-based) | VM templates + Cloud-Init | **Tie** (both support templates) |
| **Bulk VM creation** | LXD API/CLI scripting (fast) | Terraform provider or API | **Tie** |
| **GPU passthrough** | LXD GPU profile + device add | Web UI: Add PCI device | Proxmox (UI-driven vs CLI) |
| **Web management UI** | LXD UI (basic, newer) | **Proxmox Web UI** (comprehensive, battle-tested) | **Proxmox** |
| **API quality** | LXD REST API (excellent, well-documented) | Proxmox REST API (good, well-documented) | **Tie** |

### Day-2: Ongoing Operations

| Task | MicroCloud | Proxmox | Winner |
|------|-----------|---------|--------|
| **Add new node** | `microcloud add` — auto-joins cluster + Ceph + OVN | Web UI: Join cluster, then add to Ceph manually, configure network | **MicroCloud** |
| **Remove node** | `microcloud remove` | Web UI: multiple steps (migrate VMs, remove from HA, remove Ceph OSDs, remove from cluster) | **MicroCloud** |
| **Add storage** | `microceph disk add /dev/sdX` | Web UI: Create OSD for disk | **Tie** (both easy) |
| **Live migration** | `lxc move myvm target-node` | Web UI: Migrate button (1 click) | **Proxmox** (GUI) / MicroCloud (automation) |
| **Backup** | Manual (Ceph snapshots + scripting) | **Proxmox Backup Server (PBS)** — built-in, incremental, dedup, encryption | **Proxmox** (PBS is excellent) |
| **Monitoring** | External (Prometheus, Grafana) | Built-in metrics, external for deep monitoring | **Tie** |
| **Updates/patches** | `snap refresh` (atomic, rollback) | `apt upgrade` + reboot (rolling, node-by-node) | **MicroCloud** (snap updates are atomic) |
| **Ceph management** | `microceph` CLI (basic) | **Proxmox UI** (full Ceph dashboard, OSD flags, pool management, CRUSH editor) | **Proxmox** |
| **Troubleshooting** | Smaller community, Canonical support | **Massive community**, forums, extensive documentation | **Proxmox** |
| **Disaster recovery** | Ceph RBD mirroring + manual runbook | Ceph RBD mirroring + **PBS replication** (built-in) | **Proxmox** |

### Edge/Branch Management

| Task | MicroCloud | Proxmox | Winner |
|------|-----------|---------|--------|
| **Deploy edge cluster** | `microcloud init` on 3 servers (snap-based) | Install Proxmox ISO on 3 servers + manual cluster | **MicroCloud** |
| **Minimum nodes** | 3 (Ceph minimum) | 1 (no HA) or 3 (Ceph HA) | **Proxmox** (can run single-node) |
| **Edge management at scale** | Manage via LXD API from central | Manage via Proxmox Datacenter Manager or individual UIs | **MicroCloud** (unified API across all sites) |
| **Offline operation** | Full (snap-based, no external dependencies) | Full (standalone ISO) | **Tie** |
| **WAN management** | LXD API over HTTPS | Proxmox web UI over HTTPS | **Tie** |

### Manageability Summary

| Category | MicroCloud | Proxmox | Verdict |
|----------|-----------|---------|---------|
| **Day-0 (Setup)** | **Single command** | Multiple manual steps | **MicroCloud** |
| **Day-1 (Deploy)** | CLI/API focused | **Rich web UI** | **Proxmox** |
| **Day-2 (Operations)** | Good CLI, weaker UI | **Excellent UI + PBS backup** | **Proxmox** |
| **Ceph management** | Basic | **Advanced (UI + CRUSH editor)** | **Proxmox** |
| **Edge clusters** | **Fastest deploy** | Requires ISO installs | **MicroCloud** |
| **Node scaling** | **Single command** | Multiple steps | **MicroCloud** |
| **Backup/DR** | Manual/scripted | **PBS built-in** | **Proxmox** |
| **Community/docs** | Growing | **Massive (16+ years)** | **Proxmox** |
| **Learning curve** | Moderate (CLI-heavy) | Low (web UI) | **Proxmox** |
| **Automation** | Excellent (LXD API) | Good (API + Terraform) | **Tie** |

---

## 4. Overall Verdict for 54Bank

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OVERALL COMPARISON                                 │
├──────────────────┬────────────────────┬──────────────────────────────┤
│ Category         │ MicroCloud         │ Proxmox              Winner │
├──────────────────┼────────────────────┼──────────────────────────────┤
│ COST             │                    │                              │
│  Servers         │ 84 (fewer)         │ 89                   MC     │
│  Support cost    │ $286K (expensive)  │ $57K (cheap)         PVE    │
│  Total (w/spt)   │ $746K/yr           │ $531K/yr             PVE    │
│  Total (no spt)  │ $460K/yr           │ $474K/yr             MC     │
├──────────────────┼────────────────────┼──────────────────────────────┤
│ PERFORMANCE      │                    │                              │
│  Compute         │ Equal              │ Equal                Tie    │
│  Storage (Ceph)  │ Equal              │ Equal                Tie    │
│  Postgres/Tiger  │ Good (Ceph RBD)    │ Better (ZFS option)  PVE    │
│  Containers      │ Near-native        │ Good                 MC     │
│  Live migration  │ Faster (container) │ Standard (VM)        MC     │
├──────────────────┼────────────────────┼──────────────────────────────┤
│ MANAGEABILITY    │                    │                              │
│  Day-0 setup     │ Single command     │ Multi-step manual    MC     │
│  Day-1 deploy    │ CLI focused        │ Rich web UI          PVE    │
│  Day-2 ops       │ Good               │ Excellent (PBS, UI)  PVE    │
│  Edge/branch     │ Best               │ Good                 MC     │
│  Community       │ Small              │ Massive              PVE    │
│  Learning curve  │ Moderate           │ Low                  PVE    │
├──────────────────┼────────────────────┼──────────────────────────────┤
│ FINAL SCORE      │ 5 wins             │ 8 wins               PVE    │
└──────────────────┴────────────────────┴──────────────────────────────┘
```

### Recommendation

**Proxmox + Cozystack is the stronger choice for 54Bank** based on:

1. **Cost with support:** $215K/yr cheaper when you need enterprise support (banking regulation likely requires it)
2. **Postgres/TigerBeetle performance:** ZFS local storage option for latency-critical financial databases
3. **Day-2 operations:** Proxmox Backup Server, Ceph UI management, and massive community reduce operational risk
4. **Maturity for banking:** 16 years of production deployments, extensive documentation, known failure modes

**MicroCloud + Cozystack is better if:**
- You have **significant edge/branch** presence (MicroCloud's `microcloud init` is unbeatable for rapid edge deployment)
- You prefer **CLI/API-first** automation over web UI
- You want the **fewest physical servers** (84 vs 89)
- You're running **without paid support** (saves $14K/yr on hardware alone)

### Hybrid Approach (Best of Both Worlds)

Consider using **Proxmox in the data centers** (Lagos + Abuja) and **MicroCloud at edge/branch** sites:

```
Lagos DC:   Proxmox VE + Cozystack  (50 servers) — mature IaaS, ZFS for DBs, PBS backup
Abuja DR:   Proxmox VE + Cozystack  (30 servers) — same stack, Ceph cross-DC replication
Edge sites: MicroCloud + K3s         (9 servers)  — fastest deploy, snap-based, offline-capable
```

This gives you Proxmox's stability and cost-effective support for the core banking platform, plus MicroCloud's rapid edge deployment for branches — **total: 89 servers, ~$540K/yr**.

---

*Document Version: 1.0 | Generated: 2026-05-13 | Platform: 54Bank v2.0*
