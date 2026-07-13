# 54Bank Infrastructure Optimization — Millions TPS

Complete optimization guide for all 12 infrastructure components to achieve millions of transactions per second.

## Architecture Overview

```
                         ┌────────────────────┐
                         │   APISIX Gateway    │ (tuned: 65K workers, HTTP/2, keep-alive)
                         └─────────┬──────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
     ┌────────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
     │  Go Services    │  │ Rust Services  │  │ Python Services│
     │  (214 services) │  │ (160 services) │  │ (144 services) │
     └────────┬────────┘  └───────┬────────┘  └───────┬────────┘
              │                   │                   │
    ┌─────────┼───────────────────┼───────────────────┼──────────┐
    │         ▼                   ▼                   ▼          │
    │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
    │  │    Kafka     │  │ TigerBeetle  │  │   PostgreSQL     │  │
    │  │ (batch prod, │  │ (batch 8190, │  │ (PgBouncer,      │  │
    │  │  LZ4, 48     │  │  io_uring,   │  │  partitioning,   │  │
    │  │  partitions) │  │  huge pages) │  │  parallel query) │  │
    │  └─────────────┘  └──────────────┘  └──────────────────┘  │
    │         │                                      │          │
    │  ┌──────▼──────┐  ┌──────────────┐  ┌─────────▼────────┐ │
    │  │   Fluvio    │  │    Redis     │  │   OpenSearch     │ │
    │  │ (SmartMod,  │  │ (pipeline,   │  │ (bulk indexer,   │ │
    │  │  WASM)      │  │  io-threads) │  │  ISM lifecycle)  │ │
    │  └─────────────┘  └──────────────┘  └──────────────────┘ │
    │                                                           │
    │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐ │
    │  │  Temporal   │  │    Dapr      │  │    Permify       │ │
    │  │ (4096       │  │ (bulk sub,   │  │ (1M cache,       │ │
    │  │  shards)    │  │  batch pub)  │  │  batch check)    │ │
    │  └─────────────┘  └──────────────┘  └──────────────────┘ │
    │                                                           │
    │  ┌─────────────┐  ┌──────────────┐                       │
    │  │  Mojaloop   │  │  Lakehouse   │                       │
    │  │ (ProxySQL,  │  │ (DuckDB,     │                       │
    │  │  MySQL tune)│  │  Delta Lake) │                       │
    │  └─────────────┘  └──────────────┘                       │
    └──────────────────────────────────────────────────────────┘
```

## Component Optimization Summary

### Mojaloop (MySQL — cannot use PostgreSQL)
Mojaloop uses MySQL via Knex.js internally. Switching to PostgreSQL would require forking Mojaloop core.

| Optimization | Detail |
|-------------|--------|
| **InnoDB Buffer Pool** | 32GB (70% RAM), 16 instances |
| **ProxySQL** | Read/write split, connection pooling (4096 max) |
| **Redo Log** | 4GB log files, async flush |
| **Replication** | 16 parallel workers, GTID-based failover |
| **Go Adapter** | Batch transfers, circuit breaker, 100 concurrent |

### PostgreSQL
| Optimization | Detail |
|-------------|--------|
| **PgBouncer** | Transaction pooling, 10K client connections → 500 backend |
| **shared_buffers** | 16GB (25% RAM) |
| **WAL** | ZSTD compression, 16GB max, async commit |
| **Parallelism** | 16 workers, partition-wise joins |
| **Partitioning** | Range (transactions by date), hash (accounts) |

### Kafka
| Optimization | Detail |
|-------------|--------|
| **Partitions** | 48 for payments, 24 for platform events |
| **Batch Producer** | 1MB batches, 5ms linger, LZ4 compression |
| **Zero-Copy** | sendfile() for consumer fetches |
| **KRaft Mode** | No ZooKeeper dependency |

### Redis
| Optimization | Detail |
|-------------|--------|
| **Cluster** | 6 nodes (3 masters + 3 replicas) |
| **IO Threads** | 8 threads for read/write |
| **Pipeline** | 1000-command batches, 5ms flush |
| **Memory** | 16GB, LFU eviction, lazy free |

### TigerBeetle
| Optimization | Detail |
|-------------|--------|
| **Batch Size** | 8190 (max per batch) |
| **io_uring** | 256 depth for async I/O |
| **Huge Pages** | 2MB pages for memory regions |
| **Cluster** | 3 replicas + 3 standbys |
| **14 Ledgers** | Segregated by product (current, savings, loans, FX, etc.) |

### APISIX
| Optimization | Detail |
|-------------|--------|
| **Workers** | Auto (match CPU cores), 65K connections each |
| **Upstream Keepalive** | 320 connections, 10K requests per connection |
| **Rate Limiting** | Redis-cluster backed, sliding window |
| **Health Checks** | Active (5s) + Passive, circuit breaker |

### Temporal
| Optimization | Detail |
|-------------|--------|
| **History Shards** | 4096 (max parallelism) |
| **Worker Concurrency** | 1000 activities, 500 workflows |
| **Namespaces** | 5 isolated (payments, lending, compliance, ops, notifications) |
| **Cache** | 131K history entries, 1h TTL |

### Fluvio
| Optimization | Detail |
|-------------|--------|
| **SmartModules** | 5 WASM processors (enrichment, filtering, aggregation) |
| **Batch Size** | 16MB max, 1MB producer |
| **Compression** | LZ4 for speed |
| **Partitions** | 24 default per topic |

### Dapr
| Optimization | Detail |
|-------------|--------|
| **Tracing** | 1% sampling at high TPS |
| **Bulk Subscribe** | 500 messages, 100ms window |
| **State Store** | Redis cluster, 200 pool size |
| **Pub/Sub** | Kafka backend, 10MB max message |

### OpenSearch
| Optimization | Detail |
|-------------|--------|
| **Bulk Indexer** | 5000-doc batches, async translog |
| **Refresh** | 30s interval (vs 1s default) |
| **ISM** | Hot→Warm→Cold→Delete lifecycle |
| **Thread Pool** | 16 write, 25 search threads |

### Permify
| Optimization | Detail |
|-------------|--------|
| **Cache** | 1M permission entries, 60s TTL |
| **Batch Check** | 100 concurrent checks per batch |
| **Schema Cache** | 128MB, 10K counters |
| **Relationship Cache** | 256MB |

### Lakehouse (DuckDB + Delta Lake)
| Optimization | Detail |
|-------------|--------|
| **Medallion** | Bronze→Silver→Gold architecture |
| **DuckDB** | 32GB memory, ZSTD compression, parallel execution |
| **Partitioning** | Date (transactions), hash (accounts), hourly (payments) |
| **Z-ORDER** | Optimized file layout for account_id + timestamp |

## OS-Level Tuning
- Kernel: `net.core.somaxconn=65535`, `fs.file-max=2M`, `vm.swappiness=1`
- Huge Pages: 8192 x 2MB for TigerBeetle/PostgreSQL/Redis
- TCP: Fast Open, reuse, 10s FIN timeout, 64K port range

## Files
```
infra-optimization/
├── os-tuning.conf                          # Linux kernel sysctl tuning
├── mojaloop/
│   ├── mysql-tuning.cnf                    # MySQL 8.0 InnoDB tuning
│   ├── proxysql.cnf                        # ProxySQL read/write split
│   └── mojaloop-adapter/main.go            # High-perf Go adapter
├── postgres/
│   ├── postgresql-tuning.conf              # PG16 production tuning
│   ├── pgbouncer.ini                       # Connection pooling
│   └── pool-manager/main.go               # Go pool manager service
├── kafka/
│   ├── kafka-tuning.properties             # Kafka broker tuning
│   └── batch-producer/main.go             # Go batch producer
├── redis/
│   ├── redis-cluster.conf                  # Redis 7 cluster tuning
│   └── pipeline-client/main.go            # Go pipeline client
├── tigerbeetle/
│   └── batch-client/main.go               # Go batch API client
├── apisix/
│   └── apisix-tuning.yaml                  # APISIX gateway tuning
├── temporal/
│   ├── temporal-tuning.yaml                # Temporal server tuning
│   └── worker-optimizer/main.go           # Go worker optimizer
├── fluvio/
│   └── stream-processor/src/main.rs        # Rust stream processor
├── dapr/
│   └── dapr-tuning.yaml                    # Dapr sidecar + components
├── opensearch/
│   ├── opensearch-tuning.yaml              # OpenSearch cluster tuning
│   └── bulk-indexer/main.py               # Python bulk indexer
├── permify/
│   ├── permify-tuning.yaml                 # Permify ReBAC tuning
│   └── batch-checker/main.go              # Go batch permission checker
└── lakehouse/
    └── lakehouse-optimizer/main.py         # Python DuckDB/Delta optimizer
```
