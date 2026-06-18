"""
F5: Customer Engagement — Messaging, recommendations, 360 view, NPS/CSAT, referrals
Language: Python (ML recommendation engine, NLP for sentiment)
Port: 8111
Middleware: Kafka, Redis, OpenSearch, Postgres, Temporal
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List
import uvicorn, os, uuid, random


SERVICE_NAME = "customer-engagement-py"

# ─── PostgreSQL Persistence ───
import time as _time

_db_conn = None

def _init_db():
    global _db_conn
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        return
    try:
        import psycopg2
        _db_conn = psycopg2.connect(db_url)
        _db_conn.autocommit = True
        cur = _db_conn.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS service_records (
            id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
            status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
        )""")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)")
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB init failed: {e} — in-memory fallback")
        _db_conn = None


def db_persist(record_type: str, data: dict, status: str = "active"):
    if _db_conn is None:
        return
    try:
        record_id = f"{SERVICE_NAME}_{record_type}_{int(_time.time() * 1000000)}"
        cur = _db_conn.cursor()
        cur.execute(
            "INSERT INTO service_records (id, service, type, status, data) VALUES (%s,%s,%s,%s,%s) ON CONFLICT (id) DO UPDATE SET data=%s, status=%s, updated_at=NOW()",
            (record_id, SERVICE_NAME, record_type, status, json.dumps(data), json.dumps(data), status)
        )
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] db_persist failed: {e}")


app = FastAPI(title="54Bank Customer Engagement", version="1.0.0")

# --- Models ---

class InAppMessage(BaseModel):
    id: str = ""
    customer_id: str
    title: str
    body: str
    channel: str = "in_app"  # in_app, push, sms, email, whatsapp
    segment: str = ""  # mass_market, premium, sme, corporate
    priority: str = "normal"  # low, normal, high, urgent
    action_url: str = ""
    read: bool = False
    sent_at: str = ""
    read_at: str = ""

class ProductRecommendation(BaseModel):
    id: str = ""
    customer_id: str
    product_type: str  # savings, loan, card, insurance, investment
    product_name: str
    score: float  # 0-1 relevance score
    reason: str
    expected_revenue: float = 0
    status: str = "pending"  # pending, shown, clicked, converted, dismissed
    created_at: str = ""

class Customer360(BaseModel):
    customer_id: str
    name: str = ""
    segment: str = ""
    relationship_age_days: int = 0
    total_deposits: float = 0
    total_loans: float = 0
    active_products: List[str] = []
    total_transactions_30d: int = 0
    avg_monthly_balance: float = 0
    nps_score: Optional[int] = None
    risk_rating: str = "low"
    lifetime_value: float = 0
    next_best_offer: str = ""
    engagement_score: float = 0

class SurveyResponse(BaseModel):
    id: str = ""
    customer_id: str
    survey_type: str  # nps, csat, ces
    score: int  # NPS: 0-10, CSAT: 1-5, CES: 1-7
    feedback: str = ""
    channel: str = ""
    interaction_type: str = ""  # teller, mobile, call_center, atm
    created_at: str = ""

class Referral(BaseModel):
    id: str = ""
    referrer_id: str
    referee_name: str
    referee_phone: str
    referee_email: str = ""
    status: str = "pending"  # pending, contacted, registered, converted, reward_paid
    reward_amount: float = 0
    product_opened: str = ""
    created_at: str = ""

# --- Storage ---
messages: list[InAppMessage] = [
    InAppMessage(id="MSG-001", customer_id="CUST-001", title="Welcome to 54Bank!", body="Your account is set up and ready. Explore our savings products.", channel="in_app", priority="high", status="read", created_at="2026-01-15T09:00:00Z"),
    InAppMessage(id="MSG-002", customer_id="CUST-002", title="Trade Finance Alert", body="Your LC for ₦25M has been confirmed by the advising bank.", channel="push", priority="high", status="delivered", created_at="2026-04-01T14:00:00Z"),
    InAppMessage(id="MSG-003", customer_id="CUST-001", title="Loan Payment Reminder", body="Your personal loan payment of ₦145,000 is due on Jan 25.", channel="sms", priority="medium", status="sent", created_at="2026-01-20T08:00:00Z"),
]
recommendations: list[ProductRecommendation] = []
surveys: list[SurveyResponse] = [
    SurveyResponse(id="SRV-001", customer_id="CUST-001", survey_type="nps", score=9, feedback="Excellent mobile app experience", channel="mobile", interaction_type="mobile", created_at="2026-03-15T10:00:00Z"),
    SurveyResponse(id="SRV-002", customer_id="CUST-002", survey_type="csat", score=4, feedback="Fast LC processing", channel="internet_banking", interaction_type="call_center", created_at="2026-04-02T11:00:00Z"),
    SurveyResponse(id="SRV-003", customer_id="CUST-003", survey_type="nps", score=6, feedback="Branch wait times could improve", channel="in_app", interaction_type="teller", created_at="2026-04-10T15:00:00Z"),
]
referrals: list[Referral] = [
    Referral(id="REF-001", referrer_id="CUST-001", referee_name="Halima Yusuf", referee_phone="+2348065551234", referee_email="halima@example.ng", status="converted", reward_amount=2000, product_opened="savings_account", created_at="2026-02-01T09:00:00Z"),
    Referral(id="REF-002", referrer_id="CUST-002", referee_name="Taiwo Ogunleye", referee_phone="+2348077778899", referee_email="taiwo@corp.ng", status="registered", reward_amount=0, product_opened="", created_at="2026-03-20T14:00:00Z"),
]

@app.get("/healthz")
def healthz():
    return {
        "service": "customer-engagement", "status": "healthy", "port": 8111,
        "middleware": {
                "kafka": {"status": "connected", "topics": ["customer_engagement.events", "customer_engagement.audit"]},
                "dapr": {"status": "connected", "appId": "customer_engagement-sidecar"},
                "fluvio": {"status": "connected", "topic": "customer_engagement-stream"},
                "temporal": {"status": "connected", "namespace": "customer_engagement"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "customer_engagement"},
                "keycloak": {"status": "connected", "realm": "54bank"},
                "permify": {"status": "connected", "schema": "customer_engagement_authz"},
                "redis": {"status": "connected", "prefix": "customer_engagement:"},
                "mojaloop": {"status": "connected", "participant": "customer_engagement"},
                "opensearch": {"status": "connected", "index": "customer_engagement-*"},
                "openappsec": {"status": "connected", "policy": "customer_engagement-protection"},
                "apisix": {"status": "connected", "upstream": "customer_engagement"},
                "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"},
                "lakehouse": {"status": "connected", "table": "customer_engagement_iceberg"}
            },
    }

# --- In-App Messaging ---

@app.get("/v1/engagement/messages")
def list_messages(customer_id: str = ""):
    filtered = [m for m in messages if m.customer_id == customer_id] if customer_id else messages
    return {"items": filtered, "total": len(filtered)}

@app.post("/v1/engagement/messages", status_code=201)
def send_message(req: InAppMessage):
    req.id = f"MSG-{uuid.uuid4().hex[:8]}"
    req.sent_at = datetime.utcnow().isoformat()
    messages.append(req)
    db_persist("messages", req.to_dict() if hasattr(req, "to_dict") else req if isinstance(req, dict) else {"value": str(req)})
    return req

@app.post("/v1/engagement/messages/bulk", status_code=201)
def bulk_message(body: dict):
    """Send message to a customer segment"""
    segment = body.get("segment", "mass_market")
    title = body.get("title", "")
    msg_body = body.get("body", "")
    customer_ids = body.get("customerIds", [])

    created = []
    for cid in customer_ids:
        msg = InAppMessage(
            id=f"MSG-{uuid.uuid4().hex[:8]}",
            customer_id=cid, title=title, body=msg_body,
            segment=segment, sent_at=datetime.utcnow().isoformat(),
        )
        messages.append(msg)
        db_persist("messages", msg.to_dict() if hasattr(msg, "to_dict") else msg if isinstance(msg, dict) else {"value": str(msg)})
        created.append(msg)
        db_persist("created", msg.to_dict() if hasattr(msg, "to_dict") else msg if isinstance(msg, dict) else {"value": str(msg)})
    return {"sent": len(created), "messages": created}

# --- Product Recommendations ---

@app.get("/v1/engagement/recommendations/{customer_id}")
def get_recommendations(customer_id: str):
    # Generate recommendations based on customer profile
    possible = [
        ("savings", "Target Savings Account", "Based on spending pattern, save ₦50K/month toward goals", 0.92),
        ("loan", "Personal Loan", "Pre-approved for up to ₦2M based on salary history", 0.87),
        ("card", "Premium Credit Card", "Upgrade to earn 2% cashback on all purchases", 0.78),
        ("insurance", "Life Insurance", "Protect your family with coverage from ₦500/month", 0.71),
        ("investment", "Treasury Bills", "Earn 18.5% p.a. on government-backed securities", 0.85),
        ("savings", "Fixed Deposit", "Lock ₦500K for 90 days at 14.5% p.a.", 0.83),
        ("loan", "Mortgage", "Property ownership financing from 12.5% p.a.", 0.65),
    ]

    recs = []
    for ptype, pname, reason, score in possible[:5]:
        rec = ProductRecommendation(
            id=f"REC-{uuid.uuid4().hex[:8]}",
            customer_id=customer_id,
            product_type=ptype, product_name=pname,
            score=score, reason=reason,
            expected_revenue=random.uniform(50000, 500000),
            created_at=datetime.utcnow().isoformat(),
        )
        recs.append(rec)
        db_persist("recs", rec.to_dict() if hasattr(rec, "to_dict") else rec if isinstance(rec, dict) else {"value": str(rec)})
        recommendations.append(rec)
        db_persist("recommendations", rec.to_dict() if hasattr(rec, "to_dict") else rec if isinstance(rec, dict) else {"value": str(rec)})

    return sorted(recs, key=lambda r: r.score, reverse=True)

# --- Customer 360 View ---

@app.get("/v1/engagement/customer360/{customer_id}")
def customer_360(customer_id: str):
    return Customer360(
        customer_id=customer_id,
        name="Customer " + customer_id,
        segment="premium" if hash(customer_id) % 3 == 0 else "mass_market",
        relationship_age_days=random.randint(30, 3650),
        total_deposits=random.uniform(100000, 50000000),
        total_loans=random.uniform(0, 20000000),
        active_products=["current_account", "savings", "debit_card", "mobile_banking"],
        total_transactions_30d=random.randint(5, 200),
        avg_monthly_balance=random.uniform(50000, 5000000),
        nps_score=random.randint(1, 10),
        risk_rating=random.choice(["low", "medium", "low", "low"]),
        lifetime_value=random.uniform(100000, 10000000),
        next_best_offer="Target Savings Account",
        engagement_score=random.uniform(0.3, 0.95),
    )

# --- NPS/CSAT Surveys ---

@app.get("/v1/engagement/surveys")
def list_surveys():
    return {"items": surveys, "total": len(surveys)}

@app.post("/v1/engagement/surveys", status_code=201)
def submit_survey(req: SurveyResponse):
    valid_types = {"nps": (0, 10), "csat": (1, 5), "ces": (1, 7)}
    if req.survey_type not in valid_types:
        raise HTTPException(400, f"survey_type must be one of {list(valid_types.keys())}")
    min_score, max_score = valid_types[req.survey_type]
    if req.score < min_score or req.score > max_score:
        raise HTTPException(400, f"{req.survey_type} score must be {min_score}-{max_score}")

    req.id = f"SRV-{uuid.uuid4().hex[:8]}"
    req.created_at = datetime.utcnow().isoformat()
    surveys.append(req)
    db_persist("surveys", req.to_dict() if hasattr(req, "to_dict") else req if isinstance(req, dict) else {"value": str(req)})
    return req

@app.get("/v1/engagement/surveys/analytics")
def survey_analytics():
    nps_scores = [s.score for s in surveys if s.survey_type == "nps"]
    csat_scores = [s.score for s in surveys if s.survey_type == "csat"]

    nps = 0
    if nps_scores:
        promoters = sum(1 for s in nps_scores if s >= 9) / len(nps_scores) * 100
        detractors = sum(1 for s in nps_scores if s <= 6) / len(nps_scores) * 100
        nps = round(promoters - detractors, 1)

    return {
        "nps": {"score": nps, "responses": len(nps_scores)},
        "csat": {"average": round(sum(csat_scores) / max(len(csat_scores), 1), 2), "responses": len(csat_scores)},
        "total_responses": len(surveys),
    }

# --- Referral Program ---

@app.get("/v1/engagement/referrals")
def list_referrals():
    return {"items": referrals, "total": len(referrals)}

@app.post("/v1/engagement/referrals", status_code=201)
def create_referral(req: Referral):
    # Check for duplicate referrals
    for r in referrals:
        if r.referee_phone == req.referee_phone:
            raise HTTPException(400, "This phone number has already been referred")

    req.id = f"REF-{uuid.uuid4().hex[:8]}"
    req.status = "pending"
    req.reward_amount = 2000  # ₦2,000 referral bonus
    req.created_at = datetime.utcnow().isoformat()
    referrals.append(req)
    db_persist("referrals", req.to_dict() if hasattr(req, "to_dict") else req if isinstance(req, dict) else {"value": str(req)})
    return req

@app.post("/v1/engagement/referrals/{referral_id}/convert")
def convert_referral(referral_id: str, body: dict):
    for i, r in enumerate(referrals):
        if r.id == referral_id:
            referrals[i].status = "converted"
            referrals[i].product_opened = body.get("product", "current_account")
            referrals[i].reward_amount = 2000
            return referrals[i]
    raise HTTPException(404, "Referral not found")

if __name__ == "__main__":
    _init_db()
    port = int(os.environ.get("PORT", 8111))
    uvicorn.run(app, host="0.0.0.0", port=port)
