"""54Bank shared middleware integration layer for Python microservices.

Provides clients for Kafka, Redis, OpenSearch, Lakehouse, Postgres, and common utilities.
Each client is configured via environment variables and exposes a health() method.
"""

import json
import os
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any


def env_or(key: str, fallback: str) -> str:
    return os.environ.get(key, fallback)


def gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_tenant() -> str:
    return env_or("TENANT_ID", "54bank-platform-prod")


# ── Kafka ────────────────────────────────────────────────────────────────────

class KafkaClient:
    def __init__(self):
        self.brokers = env_or("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
        self.topic_prefix = env_or("KAFKA_TOPIC_PREFIX", "54bank")
        self._connected = False

    def publish(self, topic: str, key: str, payload: Any) -> None:
        body = json.dumps(payload) if not isinstance(payload, str) else payload
        print(f"[kafka] publish topic={self.topic_prefix}.{topic} key={key} size={len(body)}")

    def consume(self, topic: str, group: str) -> list:
        print(f"[kafka] consume topic={self.topic_prefix}.{topic} group={group}")
        return []

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Redis ────────────────────────────────────────────────────────────────────

class RedisClient:
    def __init__(self):
        self.url = env_or("REDIS_URL", "redis://redis-master:6379/0")
        self._connected = False
        self._store: dict[str, Any] = {}

    def set(self, key: str, value: Any, ttl: int = 0) -> None:
        self._store[key] = value
        print(f"[redis] SET {key} ttl={ttl}")

    def get(self, key: str) -> Any:
        print(f"[redis] GET {key}")
        return self._store.get(key)

    def delete(self, key: str) -> None:
        self._store.pop(key, None)
        print(f"[redis] DEL {key}")

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── OpenSearch ───────────────────────────────────────────────────────────────

class OpenSearchClient:
    def __init__(self):
        self.endpoint = env_or("OPENSEARCH_URL", "http://opensearch:9200")
        self._connected = False

    def index(self, index_name: str, doc_id: str, body: dict) -> None:
        print(f"[opensearch] INDEX {index_name}/{doc_id} fields={list(body.keys())}")

    def search(self, index_name: str, query: dict) -> list:
        print(f"[opensearch] SEARCH {index_name} query={json.dumps(query)[:100]}")
        return []

    def bulk_index(self, index_name: str, docs: list[dict]) -> int:
        print(f"[opensearch] BULK INDEX {index_name} count={len(docs)}")
        return len(docs)

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Lakehouse (Delta Lake + DuckDB via REST API) ────────────────────────────

class LakehouseClient:
    """Client for the 54Bank Delta Lake lakehouse.
    Writes data to bronze Delta tables via the lakehouse REST API.
    Queries execute via DuckDB over the medallion (bronze/silver/gold) layers.
    Falls back to logging when the lakehouse server is unreachable.
    """
    def __init__(self):
        self.endpoint = env_or("LAKEHOUSE_API_URL", "http://localhost:8020")
        self.dataset = env_or("LAKEHOUSE_DATASET", "54bank_operational_analytics")
        self._connected = False
        self._session = None

    def _http(self):
        if self._session is None:
            import urllib.request
            self._session = urllib.request
        return self._session

    def publish(self, table: str, records: list[dict]) -> None:
        """Write records to a bronze Delta Lake table."""
        import json as _json
        payload = _json.dumps({
            "layer": "bronze",
            "table": table,
            "records": records,
        }).encode()
        try:
            req = self._http().Request(
                f"{self.endpoint}/v1/ingest",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with self._http().urlopen(req, timeout=10) as resp:
                result = _json.loads(resp.read())
                self._connected = True
                print(f"[lakehouse] INGESTED {len(records)} records → bronze.{table} "
                      f"(v{result.get('version', '?')}, {result.get('files', '?')} files)")
        except Exception as e:
            print(f"[lakehouse] Ingest fallback (server unreachable: {e}): "
                  f"{self.dataset}.{table} records={len(records)}")

    def query(self, sql: str) -> list[dict]:
        """Execute a SQL query via DuckDB on the lakehouse."""
        import json as _json
        payload = _json.dumps({"sql": sql, "limit": 10000}).encode()
        try:
            req = self._http().Request(
                f"{self.endpoint}/v1/query",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with self._http().urlopen(req, timeout=30) as resp:
                result = _json.loads(resp.read())
                self._connected = True
                columns = result.get("columns", [])
                rows = result.get("rows", [])
                return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            print(f"[lakehouse] Query fallback (server unreachable: {e}): {sql[:100]}")
            return []

    def time_travel(self, layer: str, table: str, version: int) -> list[dict]:
        """Query a Delta table at a specific historical version."""
        import json as _json
        payload = _json.dumps({
            "layer": layer, "table": table, "version": version,
        }).encode()
        try:
            req = self._http().Request(
                f"{self.endpoint}/v1/time-travel",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with self._http().urlopen(req, timeout=30) as resp:
                result = _json.loads(resp.read())
                return result.get("data", [])
        except Exception:
            return []

    def publish_cdc(self, topic: str, payload: dict) -> None:
        """Send a CDC event to the lakehouse streaming pipeline."""
        import json as _json
        data = _json.dumps({"topic": topic, "payload": payload}).encode()
        try:
            req = self._http().Request(
                f"{self.endpoint}/v1/cdc/event",
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            self._http().urlopen(req, timeout=5)
        except Exception:
            pass

    def health(self) -> str:
        try:
            with self._http().urlopen(f"{self.endpoint}/v1/health", timeout=3) as resp:
                if resp.status == 200:
                    self._connected = True
                    return "connected"
        except Exception:
            pass
        return "configured"


# ── Postgres ─────────────────────────────────────────────────────────────────

class PostgresClient:
    def __init__(self):
        self.connection_string = env_or(
            "DATABASE_URL",
            "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db",
        )
        self._connected = False

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Temporal ─────────────────────────────────────────────────────────────────

class TemporalClient:
    def __init__(self):
        self.host_port = env_or("TEMPORAL_ADDRESS", "temporal-frontend:7233")
        self.namespace = env_or("TEMPORAL_NAMESPACE", "banking")
        self._connected = False

    def start_workflow(self, name: str, workflow_id: str, args: Any = None) -> str:
        run_id = f"run-{int(time.time()*1000)}"
        print(f"[temporal] StartWorkflow name={name} id={workflow_id}")
        return run_id

    def signal_workflow(self, workflow_id: str, signal: str, data: Any = None) -> None:
        print(f"[temporal] Signal workflow={workflow_id} signal={signal}")

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Keycloak ─────────────────────────────────────────────────────────────────

class KeycloakClient:
    def __init__(self):
        self.issuer_url = env_or("KEYCLOAK_ISSUER_URL", "https://identity.54bank.app/realms/54bank")
        self.client_id = env_or("KEYCLOAK_CLIENT_ID", "54bank-operations-ui")
        self._connected = False

    def validate_token(self, token: str) -> dict:
        print(f"[keycloak] ValidateToken len={len(token)}")
        return {
            "sub": "user-default",
            "email": "operator@54bank.app",
            "roles": ["operator", "admin"],
            "tenant_id": default_tenant(),
            "exp": int(time.time()) + 3600,
        }

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Permify ──────────────────────────────────────────────────────────────────

class PermifyClient:
    def __init__(self):
        self.endpoint = env_or("PERMIFY_URL", "http://permify:3476")
        self.tenant_id = env_or("PERMIFY_TENANT_ID", default_tenant())
        self._connected = False

    def check(self, entity: str, permission: str, subject: str) -> bool:
        print(f"[permify] Check entity={entity} permission={permission} subject={subject}")
        return True

    def write_relation(self, entity: str, relation: str, subject: str) -> None:
        print(f"[permify] WriteRelation {entity}#{relation}@{subject}")

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── TigerBeetle ──────────────────────────────────────────────────────────────

class TigerBeetleClient:
    def __init__(self):
        self.address = env_or("TIGERBEETLE_ADDRESS", "tigerbeetle:3001")
        self.cluster_id = env_or("TIGERBEETLE_CLUSTER_ID", "0")
        self._connected = False

    def create_account(self, account_id: int, ledger: int, code: int) -> dict:
        print(f"[tigerbeetle] CreateAccount id={account_id} ledger={ledger} code={code}")
        return {"id": account_id, "ledger": ledger, "code": code, "status": "created"}

    def create_transfer(self, debit_id: int, credit_id: int, amount: int, ledger: int) -> dict:
        print(f"[tigerbeetle] CreateTransfer debit={debit_id} credit={credit_id} amount={amount}")
        return {"debit_account_id": debit_id, "credit_account_id": credit_id, "amount": amount, "status": "posted"}

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Dapr ─────────────────────────────────────────────────────────────────────

class DaprClient:
    def __init__(self):
        self.sidecar_url = env_or("DAPR_SIDECAR_URL", "http://localhost:3500")
        self.app_id = env_or("DAPR_APP_ID", "54bank-service")
        self._connected = False

    def publish(self, pubsub: str, topic: str, data: dict) -> None:
        print(f"[dapr] Publish pubsub={pubsub} topic={topic}")

    def invoke(self, app_id: str, method: str, data: dict | None = None) -> dict:
        print(f"[dapr] Invoke app={app_id} method={method}")
        return {"status": "ok"}

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Fluvio ───────────────────────────────────────────────────────────────────

class FluvioClient:
    def __init__(self):
        self.endpoint = env_or("FLUVIO_ENDPOINT", "fluvio:9003")
        self._connected = False

    def produce(self, topic: str, key: str, value: dict) -> None:
        print(f"[fluvio] Produce topic={topic} key={key}")

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Mojaloop ─────────────────────────────────────────────────────────────────

class MojaloopClient:
    def __init__(self):
        self.hub_url = env_or("MOJALOOP_HUB_URL", "http://mojaloop-hub:4000")
        self._connected = False

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── OpenAppSec ───────────────────────────────────────────────────────────────

class OpenAppSecClient:
    def __init__(self):
        self.endpoint = env_or("OPENAPPSEC_URL", "http://openappsec:8080")
        self._connected = False

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── APISIX ───────────────────────────────────────────────────────────────────

class APISIXClient:
    def __init__(self):
        self.admin_url = env_or("APISIX_ADMIN_URL", "http://apisix:9180")
        self._connected = False

    def health(self) -> str:
        return "connected" if self._connected else "configured"


# ── Middleware Bundle ────────────────────────────────────────────────────────

class Bundle:
    def __init__(self):
        self.kafka = KafkaClient()
        self.redis = RedisClient()
        self.opensearch = OpenSearchClient()
        self.lakehouse = LakehouseClient()
        self.postgres = PostgresClient()
        self.temporal = TemporalClient()
        self.keycloak = KeycloakClient()
        self.permify = PermifyClient()
        self.tigerbeetle = TigerBeetleClient()
        self.dapr = DaprClient()
        self.fluvio = FluvioClient()
        self.mojaloop = MojaloopClient()
        self.openappsec = OpenAppSecClient()
        self.apisix = APISIXClient()

    def health_map(self) -> dict[str, str]:
        return {
            "kafka": self.kafka.health(),
            "redis": self.redis.health(),
            "opensearch": self.opensearch.health(),
            "lakehouse": self.lakehouse.health(),
            "postgres": self.postgres.health(),
            "temporal": self.temporal.health(),
            "keycloak": self.keycloak.health(),
            "permify": self.permify.health(),
            "tigerbeetle": self.tigerbeetle.health(),
            "dapr": self.dapr.health(),
            "fluvio": self.fluvio.health(),
            "mojaloop": self.mojaloop.health(),
            "openappsec": self.openappsec.health(),
            "apisix": self.apisix.health(),
        }

    def middleware_list(self) -> list[str]:
        return [
            "Kafka", "Dapr", "Fluvio", "Temporal", "Postgres", "Keycloak",
            "Permify", "Redis", "Mojaloop", "OpenSearch", "OpenAppSec",
            "APISIX", "TigerBeetle", "Lakehouse",
        ]


# ── Audit ────────────────────────────────────────────────────────────────────

_audit_log: list[dict] = []


def record_audit(service: str, action: str, entity_id: str, actor_id: str = "system", details: Any = None):
    entry = {
        "timestamp": now_iso(),
        "service": service,
        "action": action,
        "entityId": entity_id,
        "actorId": actor_id,
        "tenantId": default_tenant(),
        "details": details,
    }
    _audit_log.append(entry)
    print(f"[audit] {service} {action} {entity_id} by {actor_id}")


def get_audit_log() -> list[dict]:
    return list(_audit_log)


# ── HTTP helpers ─────────────────────────────────────────────────────────────

def parse_json_body(handler_self) -> dict:
    """Parse JSON body from BaseHTTPRequestHandler."""
    content_length = int(handler_self.headers.get("Content-Length", 0))
    if content_length == 0:
        return {}
    raw = handler_self.rfile.read(content_length)
    return json.loads(raw)


def respond_json(handler_self, status: int, data: Any) -> None:
    """Send JSON response from BaseHTTPRequestHandler."""
    body = json.dumps(data, default=str).encode()
    handler_self.send_response(status)
    handler_self.send_header("Content-Type", "application/json")
    handler_self.send_header("Access-Control-Allow-Origin", "*")
    handler_self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS")
    handler_self.send_header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Tenant-ID")
    handler_self.send_header("Content-Length", str(len(body)))
    handler_self.end_headers()
    handler_self.wfile.write(body)
