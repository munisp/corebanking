"""CBN Service"""

import json
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from enum import Enum
import uvicorn, asyncpg, os, random, hashlib
from dotenv import load_dotenv
from middlewares import RequiredHeadersMiddleware
from typing import List, Dict, Any
from pydantic import BaseModel
from datetime import date
import calendar
from fastapi import Depends
from utils.kafka_instance import KafkaClientInstance
from utils.kafka_client import CBNEventTypes

load_dotenv()

app = FastAPI(title="54Link Card Service", version="1.0.0")

_CORS_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    RequiredHeadersMiddleware,
    required_headers=[
        "x-tenant-id",
        "x-keycloak-id",
    ],
    exclude_prefixes=["/health", "/dapr"],
)


db_pool = None

@app.on_event("startup")
async def startup():
    global db_pool
    db_pool = await asyncpg.create_pool(host=os.getenv("DB_HOST", "postgres"), port=os.getenv("DB_PORT", "5432"),
        user=os.getenv("DB_USER", "postgres"), password=os.getenv("DB_PASSWORD", "postgres"),
        database=os.getenv("DB_NAME", "card_db"), min_size=5, max_size=20)
    async with db_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS cbn (
                id SERIAL PRIMARY KEY, tenant_id VARCHAR(50) NOT NULL, report_type VARCHAR(50) NOT NULL,
                report_date VARCHAR(50) NOT NULL, line_items JSONB NOT NULL, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

@app.on_event("shutdown")
async def shutdown():
    if db_pool: await db_pool.close()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "cbn-service"}

class CBNReport(BaseModel):
    report_type: str
    report_date: str
    line_items: List[Dict[str, Any]]  # <-- NOT typed
    is_draft: bool = False

class CBNReportResponse(BaseModel):
    id: int
    tenant_id: str
    report_type: str
    report_date: str
    line_items: Any
    created_at: datetime


class PaginatedCBNReports(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[CBNReportResponse]

TOTAL_REPORTS_PER_MONTH = 15

@app.get("/report/metrics")
async def report_metrics(
    x_tenant_id: str = Header(..., alias="x-tenant-id")
):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not initialized")

    today = date.today()

    # Start & end of current month
    start_of_month = date(today.year, today.month, 1)
    last_day = calendar.monthrange(today.year, today.month)[1]
    end_of_month = date(today.year, today.month, last_day)

    async with db_pool.acquire() as conn:
        submitted_count = await conn.fetchval(
            """
            SELECT COUNT(*) FROM cbn
            WHERE tenant_id = $1
              AND report_date::date BETWEEN $2 AND $3
            """,
            x_tenant_id,
            start_of_month,
            end_of_month,
        )

    submitted_count = submitted_count or 0
    pending_reports = max(TOTAL_REPORTS_PER_MONTH - submitted_count, 0)

    missed_deadlines = 0
    if today > end_of_month and submitted_count < TOTAL_REPORTS_PER_MONTH:
        missed_deadlines = pending_reports

    return {
        "total_reports_required": TOTAL_REPORTS_PER_MONTH,
        "reports_submitted_this_month": submitted_count,
        "pending_reports": pending_reports,
        "missed_deadlines": missed_deadlines,
        "current_month": f"{today.year}-{today.month:02d}",
        "deadline": end_of_month.isoformat(),
    }

@app.get("/reports", response_model=PaginatedCBNReports)
async def get_reports(
    limit: int = 20,
    offset: int = 0,
    x_tenant_id: str = Header(..., alias="x-tenant-id"),
):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    async with db_pool.acquire() as conn:
        # Total count (for pagination)
        total = await conn.fetchval(
            """
            SELECT COUNT(*) 
            FROM cbn 
            WHERE tenant_id = $1
            """,
            x_tenant_id,
        )

        # Paginated records
        rows = await conn.fetch(
            """
            SELECT id, tenant_id, report_type, report_date, line_items, created_at
            FROM cbn
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            """,
            x_tenant_id,
            limit,
            offset,
        )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [dict(row) for row in rows],
    }

@app.post("/reports/submit")
async def submit_report(
    payload: CBNReport,
    x_tenant_id: str = Header(..., alias="x-tenant-id"),
):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not initialized")

    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO cbn (tenant_id, report_type, report_date, line_items)
            VALUES ($1, $2, $3, $4)
            """,
            x_tenant_id,
            payload.report_type,
            payload.report_date,
            json.dumps(payload.line_items),  # JSONB
        )

    # Publish Kafka event for report submission
    KafkaClientInstance.publish_report_event(
        event_type=CBNEventTypes.REPORT_CREATED,
        report_id=f"{x_tenant_id}-{payload.report_type}-{payload.report_date}",
        tenant_id=x_tenant_id,
        status="submitted",
        metadata={
            "report_type": payload.report_type,
            "report_date": payload.report_date,
            "is_draft": payload.is_draft,
        },
    )

    return {
        "status": "success",
        "message": "CBN report submitted",
        "draft": payload.is_draft,
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8025")))
