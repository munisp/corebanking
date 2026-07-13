"""Card Management Service"""

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from enum import Enum
import logging
import uvicorn
import asyncpg
import os
import random
import hashlib
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
from middlewares import RequiredHeadersMiddleware, AuditMiddleware
from utils.errors import raise_http_exception_handler
from utils.kafka_instance import KafkaClientInstance
from utils.kafka_client import CardEventTypes
from utils.coa_client import CoAClient

load_dotenv()

app = FastAPI(title="54Link Card Service", version="1.0.0")

# Initialize CoA client
coa_client = CoAClient()

app.add_middleware(
    RequiredHeadersMiddleware,
    required_headers=[
        "x-tenant-id",
        "x-keycloak-id",
    ],
    exclude_prefixes=["/health", "/dapr"],
)

_CORS_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditMiddleware)

db_pool = None


class CardType(str, Enum):
    DEBIT = "debit"
    CREDIT = "credit"
    VIRTUAL = "virtual"


class CardStatus(str, Enum):
    ACTIVE = "active"
    BLOCKED = "blocked"
    LOST = "lost"


class CardCreation(BaseModel):
    account_id: str
    card_type: CardType
    name_on_card: str


class CardCreationAdmin(BaseModel):
    account_id: str
    card_type: CardType
    name_on_card: str
    customer_id: str


class SetPinSchema(BaseModel):
    pin: str


@app.on_event("startup")
async def startup():
    import logging
    global db_pool
    try:
        db_pool = await asyncpg.create_pool(
            host=os.getenv("DB_HOST", "postgres"),
            port=int(os.getenv("DB_PORT", "5432")),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "postgres"),
            database=os.getenv("DB_NAME", "card_db"),
            min_size=5,
            max_size=20,
        )
        async with db_pool.acquire() as conn:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS cards (
                    id SERIAL PRIMARY KEY, tenant_id VARCHAR(50) NOT NULL, card_id VARCHAR(50) UNIQUE NOT NULL, card_number VARCHAR(16) UNIQUE NOT NULL,
                    card_type VARCHAR(20) NOT NULL, customer_id VARCHAR(50) NOT NULL, account_id VARCHAR(50) NOT NULL,
                    name_on_card VARCHAR(255) NOT NULL, expiry_date DATE NOT NULL, cvv VARCHAR(3) NOT NULL,
                    pin_hash VARCHAR(255), status VARCHAR(20) DEFAULT 'active', daily_limit DECIMAL(15,2) DEFAULT 500000,
                    monthly_limit DECIMAL(15,2) DEFAULT 5000000, daily_spent DECIMAL(15,2) DEFAULT 0,
                    monthly_spent DECIMAL(15,2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_cards_customer ON cards(customer_id);"
            )
            # Ensure card_number column exists for databases created before this field was added
            await conn.execute(
                "ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_number VARCHAR(16);"
            )
    except Exception as exc:
        logging.getLogger(__name__).error(f"Startup DB init failed: {exc}", exc_info=True)
        raise


@app.on_event("shutdown")
async def shutdown():
    if db_pool:
        await db_pool.close()


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "card-service"}


@app.post("/api/v1/cards/issue")
async def issue_card(
    card: CardCreation,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    customer_id: str = Header(..., alias="x-keycloak-id"),
):

    try:
        # Logic to issue a valid card.

        card_id = f"CRD{int(datetime.now().timestamp())}"
        card_number = f"4{random.randint(100000000000000, 999999999999999)}"
        cvv = f"{random.randint(100, 999)}"
        expiry_date = datetime.now().date() + timedelta(days=365 * 3)

        async with db.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO cards (card_id, card_number, card_type, customer_id, account_id, name_on_card, expiry_date, cvv, tenant_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
                card_id,
                card_number,
                card.card_type.value,
                customer_id,
                card.account_id,
                card.name_on_card,
                expiry_date,
                cvv,
                tenant_id,
            )

        # Publish Kafka event for card issuance
        KafkaClientInstance.publish_card_event(
            event_type=CardEventTypes.CARD_ISSUED,
            card_id=card_id,
            tenant_id=tenant_id,
            status="active",
            metadata={
                "card_number": card_number,
                "card_type": card.card_type.value,
                "customer_id": customer_id,
                "account_id": card.account_id,
                "name_on_card": card.name_on_card,
                "expiry_date": str(expiry_date),
            },
        )

        return {
            "status": "issued",
            "card_id": card_id,
            "card_number": card_number,
            "expiry_date": expiry_date,
        }
    except Exception as e:
        raise_http_exception_handler(
            500, f"Failed to issue card: {str(e)}", "CRD-ISSUE-5001"
        )


@app.post("/api/v1/cards/issue/admin")
async def issue_card_admin(
    card: CardCreation,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):

    try:
        # Logic to issue a valid card.

        card_id = f"CRD{int(datetime.now().timestamp())}"
        card_number = f"4{random.randint(100000000000000, 999999999999999)}"
        cvv = f"{random.randint(100, 999)}"
        expiry_date = datetime.now().date() + timedelta(days=365 * 3)

        async with db.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO cards (card_id, card_number, card_type, customer_id, account_id, name_on_card, expiry_date, cvv, tenant_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
                card_id,
                card_number,
                card.card_type.value,
                card.customer_id,
                card.account_id,
                card.name_on_card,
                expiry_date,
                cvv,
                tenant_id,
            )

        # Publish Kafka event for card issuance
        KafkaClientInstance.publish_card_event(
            event_type=CardEventTypes.CARD_ISSUED,
            card_id=card_id,
            tenant_id=tenant_id,
            status="active",
            metadata={
                "card_number": card_number,
                "card_type": card.card_type.value,
                "customer_id": card.customer_id,
                "account_id": card.account_id,
                "name_on_card": card.name_on_card,
                "expiry_date": str(expiry_date),
            },
        )

        return {
            "status": "issued",
            "card_id": card_id,
            "card_number": card_number,
            "expiry_date": expiry_date,
        }
    except Exception as e:
        raise_http_exception_handler(
            500, f"Failed to issue card: {str(e)}", "CRD-ISSUE-5001"
        )


@app.get("/api/v1/cards/tenant")
async def list_tenant_cards(
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    try:
        async with db.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM cards WHERE tenant_id = $1 ORDER BY created_at DESC",
                tenant_id,
            )

        cards = []

        for row in rows:
            card = dict(row)
            raw_pan = card.get("card_number") or ""
            card["card_number"] = f"****{raw_pan[-4:]}" if raw_pan else None
            card["cvv"] = "***"
            cards.append(card)

        return {"cards": cards, "total": len(cards)}
    except Exception as e:
        logger.error(f"list_tenant_cards failed: {type(e).__name__}: {e}", exc_info=True)
        raise_http_exception_handler(
            500, f"Failed to fetch cards: {str(e)}", "CRD-LIST-5001"
        )


@app.get("/api/v1/cards/customer")
async def list_customer_cards(
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    customer_id: str = Header(..., alias="x-keycloak-id"),
):
    async with db.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM cards WHERE customer_id = $1 AND tenant_id = $2 ORDER BY created_at DESC",
            customer_id,
            tenant_id,
        )

        cards = []

        for row in rows:
            cards.append(dict(row))

        return {"customer_id": customer_id, "cards": cards, "total": len(cards)}


@app.post("/api/v1/cards/{card_id}/set-pin")
async def set_pin(
    card_id: str,
    payload: SetPinSchema,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    customer_id: str = Header(..., alias="x-keycloak-id"),
):
    try:
        if len(payload.pin) != 4 or not payload.pin.isdigit():
            raise HTTPException(status_code=400, detail="PIN must be 4 digits")

        pin_hash = hashlib.sha256(payload.pin.encode()).hexdigest()

        async with db.acquire() as conn:
            await conn.execute(
                "UPDATE cards SET pin_hash = $1 WHERE card_id = $2 AND customer_id = $3 AND tenant_id = $4",
                pin_hash,
                card_id,
                customer_id,
                tenant_id,
            )

        return {"message": "success", "card_id": card_id}
    except Exception as e:
        raise_http_exception_handler(
            500, f"Failed to set PIN: {str(e)}", "CRD-SETPIN-5001"
        )


@app.post("/api/v1/cards/{card_id}/freeze")
async def freeze_card(
    card_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    customer_id: str = Header(..., alias="x-keycloak-id"),
):
    try:
        async with db.acquire() as conn:
            await conn.execute(
                "UPDATE cards SET status = 'frozen' WHERE card_id = $1 AND customer_id = $2 AND tenant_id = $3",
                card_id,
                customer_id,
                tenant_id,
            )

        return {"status": "frozen", "card_id": card_id}
    except Exception as e:
        raise_http_exception_handler(
            500, f"Failed to freeze card: {str(e)}", "CRD-FREEZE-5001"
        )


@app.post("/api/v1/cards/{card_id}/unfreeze")
async def unfreeze_card(
    card_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    customer_id: str = Header(..., alias="x-keycloak-id"),
):
    try:
        async with db.acquire() as conn:
            await conn.execute(
                "UPDATE cards SET status = 'active' WHERE card_id = $1 AND customer_id = $2 AND tenant_id = $3",
                card_id,
                customer_id,
                tenant_id,
            )

        return {"status": "active", "card_id": card_id}
    except Exception as e:
        raise_http_exception_handler(
            500, f"Failed to unfreeze card: {str(e)}", "CRD-UNFREEZE-5001"
        )


@app.post("/api/v1/cards/{card_id}/block")
async def block_card(
    card_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    try:
        async with db.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM cards WHERE card_id = $1 AND tenant_id = $2",
                card_id,
                tenant_id,
            )

            if not row:
                raise Exception("Card not found")

            await conn.execute(
                "UPDATE cards SET status = 'blocked' WHERE card_id = $1 AND tenant_id = $2",
                card_id,
                tenant_id,
            )

        return {"status": "blocked", "card_id": card_id}
    except Exception as e:
        raise_http_exception_handler(
            500, f"Failed to block card: {str(e)}", "CRD-BLOCK-5001"
        )


@app.post("/api/v1/cards/{card_id}/unblock")
async def unblock_card(
    card_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    customer_id: str = Header(..., alias="x-keycloak-id"),
):
    try:
        async with db.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM cards WHERE card_id = $1 AND tenant_id = $2",
                card_id,
                tenant_id,
            )

            if not row:
                raise Exception("Card not found")

            await conn.execute(
                "UPDATE cards SET status = 'active' WHERE card_id = $1 AND tenant_id = $2",
                card_id,
                tenant_id,
            )

        return {"status": "active", "card_id": card_id}
    except Exception as e:
        raise_http_exception_handler(
            500, f"Failed to unblock card: {str(e)}", "CRD-UNBLOCK-5001"
        )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8017")))
