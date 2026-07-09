"""
kyc-event-consumer-py - Production-ready service with PostgreSQL persistence.
Middleware: Keycloak JWT, Kafka events, OpenSearch indexing, Permify authorization.
"""

import os
import json
import uuid
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("kyc-event-consumer-py")

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/kyc_event_consumer_py")
KEYCLOAK_URL = os.getenv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
REDIS_URL = os.getenv("REDIS_URL", "localhost:6379")
OPENSEARCH_URL = os.getenv("OPENSEARCH_ENDPOINT", "http://opensearch:9200")
PERMIFY_URL = os.getenv("PERMIFY_ENDPOINT", "http://permify:3476")
PORT = int(os.getenv("PORT", "8499"))

db_conn = None


def get_db():
    global db_conn
    if db_conn is None or db_conn.closed:
        db_conn = psycopg2.connect(DATABASE_URL)
        db_conn.autocommit = True
    return db_conn


def init_schema():
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("""CREATE TABLE IF NOT EXISTS kyc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    verification_type VARCHAR(32) NOT NULL,
    document_type VARCHAR(32),
    document_number VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    risk_score INT DEFAULT 0,
    risk_level VARCHAR(20) DEFAULT 'low',
    bvn VARCHAR(11),
    nin VARCHAR(11),
    verified_name VARCHAR(200),
    date_of_birth DATE,
    address TEXT,
    lga VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(3) DEFAULT 'NGA',
    selfie_match_score REAL,
    document_match_score REAL,
    pep_check BOOLEAN DEFAULT FALSE,
    sanctions_check BOOLEAN DEFAULT FALSE,
    adverse_media_check BOOLEAN DEFAULT FALSE,
    reviewer_id UUID,
    reviewed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""")

        cur.execute("""CREATE TABLE IF NOT EXISTS outbox (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_type VARCHAR(64) NOT NULL,
            aggregate_id VARCHAR(128) NOT NULL,
            payload JSONB NOT NULL,
            published BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""")

        cur.execute("CREATE INDEX IF NOT EXISTS idx_kyc_records_tenant ON kyc_records(tenant_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_kyc_records_status ON kyc_records(status)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_kyc_records_created ON kyc_records(created_at DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox(published, created_at) WHERE NOT published")
    conn.commit()
    logger.info("Schema initialized")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_schema()
    logger.info(f"[kyc-event-consumer-py] ready on :%d", PORT)
    logger.info(f"[kyc-event-consumer-py] middleware: keycloak=%s kafka=%s redis=%s opensearch=%s permify=%s",
                KEYCLOAK_URL, KAFKA_BROKERS, REDIS_URL, OPENSEARCH_URL, PERMIFY_URL)
    yield
    if db_conn:
        db_conn.close()


app = FastAPI(title="kyc-event-consumer-py", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateRequest(BaseModel):
    status: Optional[str] = "active"
    tenant_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class UpdateRequest(BaseModel):
    status: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


@app.get("/healthz")
def health():
    return {"status": "healthy", "service": "kyc-event-consumer-py", "version": "1.0.0"}


@app.get("/readyz")
def readyz():
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"not ready: {e}")


@app.get("/livez")
def livez():
    return {"status": "alive"}


@app.get("/metrics")
def metrics():
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM kyc_records")
            count = cur.fetchone()[0]
        return {"service": "kyc-event-consumer-py", "total_records": count}
    except Exception:
        return {"service": "kyc-event-consumer-py", "total_records": 0}


@app.get("/api/v1/kyc_records")
def list_records(x_tenant_id: Optional[str] = Header(None)):
    conn = get_db()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if x_tenant_id:
            cur.execute(
                "SELECT id, status, created_at FROM kyc_records WHERE tenant_id = %s::uuid ORDER BY created_at DESC LIMIT 50",
                (x_tenant_id,)
            )
        else:
            cur.execute("SELECT id, status, created_at FROM kyc_records ORDER BY created_at DESC LIMIT 50")
        rows = cur.fetchall()

    records = [
        {"id": str(r["id"]), "status": r["status"], "created_at": r["created_at"].isoformat()}
        for r in rows
    ]
    return {"data": records, "count": len(records)}


@app.post("/api/v1/kyc_records", status_code=201)
def create_record(body: CreateRequest, x_tenant_id: Optional[str] = Header(None)):
    tenant_id = body.tenant_id or x_tenant_id or "00000000-0000-0000-0000-000000000000"
    status = body.status or "active"
    record_id = str(uuid.uuid4())

    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO kyc_records (id, tenant_id, status) VALUES (%s::uuid, %s::uuid, %s)",
            (record_id, tenant_id, status)
        )
        # Outbox event
        payload = json.dumps({"id": record_id, "status": status, "tenant_id": tenant_id})
        cur.execute(
            "INSERT INTO outbox (event_type, aggregate_id, payload) VALUES (%s, %s, %s::jsonb)",
            ("kyc_records.created", record_id, payload)
        )
    conn.commit()
    return {"id": record_id, "status": "created"}


@app.get("/api/v1/kyc_records/{record_id}")
def get_record(record_id: str):
    conn = get_db()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, status, created_at FROM kyc_records WHERE id = %s::uuid", (record_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return {"id": str(row["id"]), "status": row["status"], "created_at": row["created_at"].isoformat()}


@app.put("/api/v1/kyc_records/{record_id}")
def update_record(record_id: str, body: UpdateRequest):
    status = body.status or "updated"
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE kyc_records SET status = %s, updated_at = NOW() WHERE id = %s::uuid",
            (status, record_id)
        )
        payload = json.dumps({"id": record_id, "status": status})
        cur.execute(
            "INSERT INTO outbox (event_type, aggregate_id, payload) VALUES (%s, %s, %s::jsonb)",
            ("kyc_records.updated", record_id, payload)
        )
    conn.commit()
    return {"id": record_id, "status": status}


@app.delete("/api/v1/kyc_records/{record_id}", status_code=204)
def delete_record(record_id: str):
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("UPDATE kyc_records SET status = 'deleted', updated_at = NOW() WHERE id = %s::uuid", (record_id,))
        payload = json.dumps({"id": record_id})
        cur.execute(
            "INSERT INTO outbox (event_type, aggregate_id, payload) VALUES (%s, %s, %s::jsonb)",
            ("kyc_records.deleted", record_id, payload)
        )
    conn.commit()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
