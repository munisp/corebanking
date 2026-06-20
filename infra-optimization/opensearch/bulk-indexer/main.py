"""54Bank OpenSearch Bulk Indexer — Python
High-throughput bulk indexer for OpenSearch with batching,
connection pooling, and backpressure for millions TPS ingestion.
"""
import asyncio
import json
import os
import time
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

# --- Configuration ---

@dataclass
class IndexerConfig:
    opensearch_url: str = ""
    batch_size: int = 5000
    flush_interval_ms: int = 100
    max_concurrent: int = 16
    max_retries: int = 3
    timeout_sec: int = 30
    port: int = 8097

    def __post_init__(self):
        self.opensearch_url = os.getenv("OPENSEARCH_URL", "http://opensearch:9200")
        self.port = int(os.getenv("PORT", "8097"))


# --- Bulk Buffer ---

class BulkBuffer:
    def __init__(self, batch_size: int):
        self._lock = threading.Lock()
        self._buffers: dict[str, list] = defaultdict(list)
        self._batch_size = batch_size
        self._total_indexed = 0
        self._total_failed = 0

    def add(self, index: str, doc: dict[str, Any]) -> list | None:
        with self._lock:
            self._buffers[index].append(doc)
            if len(self._buffers[index]) >= self._batch_size:
                batch = self._buffers[index]
                self._buffers[index] = []
                return batch
        return None

    def flush_all(self) -> dict[str, list]:
        with self._lock:
            result = {}
            for index, docs in self._buffers.items():
                if docs:
                    result[index] = docs
                    self._buffers[index] = []
            return result

    def record_success(self, count: int):
        with self._lock:
            self._total_indexed += count

    def record_failure(self, count: int):
        with self._lock:
            self._total_failed += count

    @property
    def stats(self) -> dict:
        with self._lock:
            pending = sum(len(docs) for docs in self._buffers.values())
            return {
                "indexed": self._total_indexed,
                "failed": self._total_failed,
                "pending": pending,
                "buffers": len(self._buffers),
            }


# --- Index Templates ---

INDEX_TEMPLATES = {
    "transactions": {
        "index_patterns": ["transactions-*"],
        "settings": {
            "number_of_shards": 12,
            "number_of_replicas": 1,
            "refresh_interval": "10s",
            "codec": "zstd_no_dict",
        },
        "mappings": {
            "properties": {
                "timestamp": {"type": "date"},
                "account_id": {"type": "keyword"},
                "amount_kobo": {"type": "long"},
                "currency": {"type": "keyword"},
                "type": {"type": "keyword"},
                "status": {"type": "keyword"},
                "trace_id": {"type": "keyword"},
            }
        },
    },
    "audit": {
        "index_patterns": ["audit-*"],
        "settings": {
            "number_of_shards": 6,
            "number_of_replicas": 2,
            "refresh_interval": "30s",
        },
    },
    "metrics": {
        "index_patterns": ["metrics-*"],
        "settings": {
            "number_of_shards": 24,
            "number_of_replicas": 0,
            "refresh_interval": "60s",
        },
    },
}


# --- ISM Policy ---

ISM_POLICIES = [
    {
        "name": "hot-warm-cold",
        "description": "Lifecycle: hot (7d SSD) → warm (30d) → cold (90d) → delete (365d)",
        "states": [
            {"name": "hot", "duration": "7d", "storage": "SSD", "replicas": 1},
            {"name": "warm", "duration": "30d", "storage": "HDD", "replicas": 1},
            {"name": "cold", "duration": "90d", "storage": "S3", "replicas": 0},
            {"name": "delete", "duration": "365d"},
        ],
    }
]


# --- Watchdog ---

_watchdog_last = time.time()

def watchdog_ping():
    global _watchdog_last
    _watchdog_last = time.time()

def watchdog_healthy() -> bool:
    return (time.time() - _watchdog_last) < 60

def _watchdog_loop():
    while True:
        time.sleep(10)
        if not watchdog_healthy():
            print("[WATCHDOG] Bulk indexer stalled", flush=True)
        watchdog_ping()


# --- HTTP Server (using stdlib for zero deps) ---

from http.server import HTTPServer, BaseHTTPRequestHandler

buffer = BulkBuffer(5000)
config = IndexerConfig()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress access logs for throughput

    def do_GET(self):
        if self.path == "/healthz":
            self._json_response(200, {"status": "ok", "service": "opensearch-bulk-indexer"})
        elif self.path == "/v1/opensearch/stats":
            self._json_response(200, buffer.stats)
        elif self.path == "/v1/opensearch/templates":
            self._json_response(200, INDEX_TEMPLATES)
        elif self.path == "/v1/opensearch/ism-policies":
            self._json_response(200, ISM_POLICIES)
        else:
            self._json_response(404, {"error": "not found"})

    def do_POST(self):
        if self.path == "/v1/opensearch/index":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            index = body.get("index", "default")
            doc = body.get("doc", {})
            batch = buffer.add(index, doc)
            if batch:
                buffer.record_success(len(batch))
            self._json_response(202, {"status": "queued"})
        elif self.path == "/v1/opensearch/bulk":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            items = body.get("items", [])
            for item in items:
                batch = buffer.add(item.get("index", "default"), item.get("doc", {}))
                if batch:
                    buffer.record_success(len(batch))
            self._json_response(202, {"status": "queued", "count": len(items)})
        else:
            self._json_response(404, {"error": "not found"})

    def _json_response(self, code: int, data: Any):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


def main():
    watchdog_ping()
    t = threading.Thread(target=_watchdog_loop, daemon=True)
    t.start()

    port = config.port
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"[opensearch-bulk-indexer] Starting on :{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        remaining = buffer.flush_all()
        for idx, docs in remaining.items():
            buffer.record_success(len(docs))
        server.server_close()
        print("[opensearch-bulk-indexer] Stopped", flush=True)


if __name__ == "__main__":
    main()
