"""Reporting and Analytics Service"""
from fastapi import FastAPI, Header, Depends
from audit_middleware import AuditMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal
import uvicorn, asyncpg, os
from dotenv import load_dotenv
from utils.coa_client import CoAClient

load_dotenv()

# Initialize CoA Client
coa_client = CoAClient()

app = FastAPI(title="54Link Reporting Service", version="1.0.0")

app.add_middleware(AuditMiddleware)

db_pool = None

@app.on_event("startup")
async def startup():
    global db_pool
    db_pool = await asyncpg.create_pool(host=os.getenv("DB_HOST", "postgres"), port=os.getenv("DB_PORT", "5432"),
        user=os.getenv("DB_USER", "postgres"), password=os.getenv("DB_PASSWORD", "postgres"),
        database=os.getenv("DB_NAME", "reporting_db"), min_size=5, max_size=20)

@app.on_event("shutdown")
async def shutdown():
    if db_pool: await db_pool.close()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "reporting-service"}

@app.get("/api/v1/reports/dashboard")
async def get_dashboard(
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    return {
        "tenant_id": tenant_id,
        "total_customers": 1000,
        "total_accounts": 1500,
        "total_transactions": 50000,
        "total_volume": 1000000000,
        "active_users": 800
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8022")))
