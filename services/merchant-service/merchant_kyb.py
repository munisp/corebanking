"""
Merchant KYB (Know Your Business) Verification Module
Handles business verification, document validation, and compliance checks

Fail-closed behavior: sanctions/PEP screening is performed by calling the
kyc-aml-screening service (SANCTIONS_SCREENING_URL). If screening cannot be
completed, sanctions_check/pep_check are None, no final risk tier is computed,
and the assessment is persisted with status "pending_screening".
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum
import asyncpg
import asyncio
import json
import logging
import os
import urllib.request
import urllib.error

logger = logging.getLogger("merchant-kyb")

router = APIRouter(prefix="/api/v1/merchants", tags=["KYB Verification"])

# Sanctions/PEP screening service (kyc-aml-screening-py, port 8136 by default)
SANCTIONS_SCREENING_URL = os.getenv("SANCTIONS_SCREENING_URL", "http://localhost:8136")
SCREENING_TIMEOUT_SECONDS = float(os.getenv("SANCTIONS_SCREENING_TIMEOUT", "10"))

class DocumentType(str, Enum):
    BUSINESS_REGISTRATION = "business_registration"
    TAX_CERTIFICATE = "tax_certificate"
    BANK_STATEMENT = "bank_statement"
    UTILITY_BILL = "utility_bill"
    DIRECTORS_ID = "directors_id"
    MEMORANDUM = "memorandum_of_association"
    ARTICLES = "articles_of_association"

class VerificationStatus(str, Enum):
    PENDING = "pending"
    IN_REVIEW = "in_review"
    VERIFIED = "verified"
    REJECTED = "rejected"
    ADDITIONAL_INFO_REQUIRED = "additional_info_required"

class DocumentSubmission(BaseModel):
    document_type: DocumentType
    document_url: str
    document_number: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None

class KYBSubmission(BaseModel):
    merchant_id: str
    documents: List[DocumentSubmission]
    business_owners: List[Dict]
    directors: List[Dict]
    beneficial_owners: List[Dict]
    additional_info: Optional[Dict] = None

class KYBVerificationDecision(BaseModel):
    merchant_id: str
    decision: VerificationStatus
    verified_by: str
    verification_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    required_documents: Optional[List[str]] = None

class RiskAssessment(BaseModel):
    merchant_id: str
    risk_level: str  # low, medium, high
    risk_factors: List[str]
    compliance_score: int  # 0-100
    aml_check: bool
    sanctions_check: bool
    pep_check: bool


def _screen_names_http(names: List[str]) -> Dict:
    """Blocking HTTP call to the sanctions/PEP screening service (batch)."""
    url = SANCTIONS_SCREENING_URL.rstrip("/") + "/v1/aml/batch-screen"
    payload = json.dumps({"names": names}).encode()
    req = urllib.request.Request(
        url, data=payload, method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=SCREENING_TIMEOUT_SECONDS) as resp:
        return json.loads(resp.read().decode())


async def screen_parties(names: List[str]) -> Dict:
    """Screen party names against sanctions/PEP lists via the screening service."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _screen_names_http, names)


def _collect_party_names(merchant, kyb) -> List[str]:
    """Collect real party names for screening: business name + owners/directors/UBOs."""
    names = []
    business_name = merchant["business_name"] if merchant else None
    if business_name:
        names.append(business_name)
    if kyb:
        for key in ("business_owners", "directors", "beneficial_owners"):
            try:
                parties = json.loads(kyb[key]) if kyb[key] else []
            except Exception:
                parties = []
            for party in parties:
                if isinstance(party, dict):
                    name = party.get("name") or party.get("full_name") or party.get("fullName")
                    if name:
                        names.append(name)
    return names


@router.post("/{merchant_id}/kyb/submit")
async def submit_kyb_documents(
    merchant_id: str,
    submission: KYBSubmission,
    db: asyncpg.Pool = Depends()
):
    """Submit KYB documents for verification"""
    async with db.acquire() as conn:
        # Check if merchant exists
        merchant = await conn.fetchrow(
            "SELECT * FROM merchants WHERE merchant_id = $1",
            merchant_id
        )
        if not merchant:
            raise HTTPException(status_code=404, detail="Merchant not found")
        
        # Check if KYB already submitted
        existing = await conn.fetchrow(
            "SELECT * FROM merchant_kyb_verification WHERE merchant_id = $1",
            merchant_id
        )
        
        documents_json = json.dumps([doc.dict() for doc in submission.documents])
        business_owners_json = json.dumps(submission.business_owners)
        directors_json = json.dumps(submission.directors)
        beneficial_owners_json = json.dumps(submission.beneficial_owners)
        additional_info_json = json.dumps(submission.additional_info) if submission.additional_info else None
        
        if existing:
            # Update existing submission
            await conn.execute("""
                UPDATE merchant_kyb_verification
                SET documents = $1, business_owners = $2, directors = $3,
                    beneficial_owners = $4, additional_info = $5,
                    verification_status = 'in_review', updated_at = CURRENT_TIMESTAMP
                WHERE merchant_id = $6
            """, documents_json, business_owners_json, directors_json,
                beneficial_owners_json, additional_info_json, merchant_id)
        else:
            # Create new submission
            await conn.execute("""
                INSERT INTO merchant_kyb_verification (
                    merchant_id, documents, business_owners, directors,
                    beneficial_owners, additional_info, verification_status
                ) VALUES ($1, $2, $3, $4, $5, $6, 'in_review')
            """, merchant_id, documents_json, business_owners_json, directors_json,
                beneficial_owners_json, additional_info_json)
        
        # Update merchant KYB status
        await conn.execute("""
            UPDATE merchants
            SET kyb_status = 'in_progress', updated_at = CURRENT_TIMESTAMP
            WHERE merchant_id = $1
        """, merchant_id)
        
        return {
            "status": "submitted",
            "merchant_id": merchant_id,
            "verification_status": "in_review",
            "submitted_at": datetime.now()
        }

@router.get("/{merchant_id}/kyb/status")
async def get_kyb_status(merchant_id: str, db: asyncpg.Pool = Depends()):
    """Get KYB verification status"""
    async with db.acquire() as conn:
        kyb = await conn.fetchrow("""
            SELECT * FROM merchant_kyb_verification
            WHERE merchant_id = $1
        """, merchant_id)
        
        if not kyb:
            return {
                "merchant_id": merchant_id,
                "verification_status": "not_started",
                "message": "KYB verification not yet initiated"
            }
        
        return {
            "merchant_id": merchant_id,
            "verification_status": kyb['verification_status'],
            "documents": json.loads(kyb['documents']) if kyb['documents'] else [],
            "verification_notes": kyb['verification_notes'],
            "verified_by": kyb['verified_by'],
            "verified_at": kyb['verified_at'],
            "rejection_reason": kyb['rejection_reason'],
            "created_at": kyb['created_at'],
            "updated_at": kyb['updated_at']
        }

@router.post("/{merchant_id}/kyb/verify")
async def verify_kyb(
    merchant_id: str,
    decision: KYBVerificationDecision,
    db: asyncpg.Pool = Depends()
):
    """Make KYB verification decision (admin only)"""
    async with db.acquire() as conn:
        # Check if KYB submission exists
        kyb = await conn.fetchrow(
            "SELECT * FROM merchant_kyb_verification WHERE merchant_id = $1",
            merchant_id
        )
        if not kyb:
            raise HTTPException(status_code=404, detail="KYB submission not found")
        
        # Update verification status
        await conn.execute("""
            UPDATE merchant_kyb_verification
            SET verification_status = $1, verified_by = $2, verification_notes = $3,
                rejection_reason = $4, verified_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE merchant_id = $5
        """, decision.decision.value, decision.verified_by, decision.verification_notes,
            decision.rejection_reason, merchant_id)
        
        # Update merchant status based on decision
        if decision.decision == VerificationStatus.VERIFIED:
            new_status = "active"
            kyb_status = "verified"
        elif decision.decision == VerificationStatus.REJECTED:
            new_status = "suspended"
            kyb_status = "rejected"
        else:
            new_status = "pending"
            kyb_status = "in_progress"
        
        await conn.execute("""
            UPDATE merchants
            SET status = $1, kyb_status = $2, updated_at = CURRENT_TIMESTAMP
            WHERE merchant_id = $3
        """, new_status, kyb_status, merchant_id)
        
        return {
            "status": "decision_recorded",
            "merchant_id": merchant_id,
            "decision": decision.decision.value,
            "merchant_status": new_status,
            "verified_by": decision.verified_by,
            "verified_at": datetime.now()
        }

@router.post("/{merchant_id}/kyb/risk-assessment")
async def perform_risk_assessment(
    merchant_id: str,
    db: asyncpg.Pool = Depends()
):
    """Perform risk assessment on merchant.

    Sanctions/PEP screening is a hard dependency: when the screening service
    cannot be reached (or returns an error), sanctions_check/pep_check are
    None, no final pass/fail risk tier is computed, and the assessment is
    persisted with status "pending_screening" for later re-screening.
    """
    async with db.acquire() as conn:
        # Get merchant and KYB data
        merchant = await conn.fetchrow(
            "SELECT * FROM merchants WHERE merchant_id = $1",
            merchant_id
        )
        if not merchant:
            raise HTTPException(status_code=404, detail="Merchant not found")
        
        kyb = await conn.fetchrow(
            "SELECT * FROM merchant_kyb_verification WHERE merchant_id = $1",
            merchant_id
        )
        
        # Calculate risk score from real factors only
        risk_factors = []
        risk_score = 0
        
        # Industry risk
        high_risk_industries = ['gambling', 'crypto', 'forex', 'adult_content']
        if merchant['industry'] and merchant['industry'].lower() in high_risk_industries:
            risk_factors.append("High-risk industry")
            risk_score += 30
        
        # Document completeness
        if kyb:
            documents = json.loads(kyb['documents']) if kyb['documents'] else []
            required_docs = ['business_registration', 'tax_certificate', 'bank_statement']
            submitted_doc_types = [doc['document_type'] for doc in documents]
            missing_docs = [doc for doc in required_docs if doc not in submitted_doc_types]
            
            if missing_docs:
                risk_factors.append(f"Missing documents: {', '.join(missing_docs)}")
                risk_score += 20
        else:
            risk_factors.append("KYB not submitted")
            risk_score += 40
        
        # Business age from the real registration date; unknown when not on file
        registration_date = merchant['registration_date'] if 'registration_date' in merchant.keys() else None
        if registration_date:
            try:
                if isinstance(registration_date, str):
                    reg_dt = datetime.fromisoformat(registration_date[:10])
                else:
                    reg_dt = registration_date.replace(tzinfo=None) if getattr(registration_date, 'tzinfo', None) else registration_date
                age_days = (datetime.now() - reg_dt).days
                if age_days < 365:
                    risk_factors.append("New business (< 1 year)")
                    risk_score += 15
            except Exception:
                risk_factors.append("Business age unknown (registration date unparsable)")
        else:
            risk_factors.append("Business age unknown (no registration date on file)")
        
        # Sanctions/PEP screening via the screening service (fail closed)
        screening_names = _collect_party_names(merchant, kyb)
        assessment_status = "completed"
        sanctions_check: Optional[bool] = None
        pep_check: Optional[bool] = None
        try:
            if not screening_names:
                raise ValueError("no party names available to screen")
            screen = await screen_parties(screening_names)
            screen_results = screen.get("results", [])
            sanctions_check = not any(r.get("status") == "sanctions_match" for r in screen_results)
            pep_check = not any(r.get("status") == "pep_match" for r in screen_results)
            if sanctions_check is False:
                risk_factors.append("Sanctions watchlist match")
                risk_score += 100
            elif pep_check is False:
                risk_factors.append("PEP match found")
                risk_score += 25
        except Exception as e:
            logger.error(
                "sanctions_screening_failed merchant=%s error=%s — assessment will be pending_screening",
                merchant_id, e,
            )
            assessment_status = "pending_screening"
            sanctions_check = None
            pep_check = None
            risk_factors.append("Sanctions/PEP screening unavailable — cannot clear merchant")
        
        # Determine risk level — never compute a final tier without screening
        if assessment_status == "pending_screening":
            risk_level = "pending_screening"
            aml_check: Optional[bool] = None
            compliance_score: Optional[int] = None
        else:
            if risk_score >= 60:
                risk_level = "high"
            elif risk_score >= 30:
                risk_level = "medium"
            else:
                risk_level = "low"
            aml_check = risk_score < 70
            compliance_score = max(0, 100 - risk_score)
        
        assessment = {
            "merchant_id": merchant_id,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "risk_factors": risk_factors,
            "compliance_score": compliance_score,
            "aml_check": aml_check,
            "sanctions_check": sanctions_check,
            "pep_check": pep_check,
            "status": assessment_status,
            "assessed_at": datetime.now()
        }
        
        # Store assessment. Fail loudly if the (legacy NOT NULL) schema rejects
        # a pending row rather than persisting a fabricated pass/fail result.
        persisted = True
        try:
            await conn.execute("""
                INSERT INTO merchant_risk_assessments (
                    merchant_id, risk_level, risk_score, risk_factors,
                    compliance_score, aml_check, sanctions_check, pep_check
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """, merchant_id, risk_level, risk_score, json.dumps(risk_factors),
                compliance_score, aml_check, sanctions_check, pep_check)
        except Exception as e:
            persisted = False
            logger.error("risk_assessment_persist_failed merchant=%s error=%s", merchant_id, e)
        assessment["persisted"] = persisted
        
        return assessment

@router.get("/{merchant_id}/kyb/documents")
async def get_kyb_documents(merchant_id: str, db: asyncpg.Pool = Depends()):
    """Get list of submitted KYB documents"""
    async with db.acquire() as conn:
        kyb = await conn.fetchrow(
            "SELECT documents FROM merchant_kyb_verification WHERE merchant_id = $1",
            merchant_id
        )
        
        if not kyb or not kyb['documents']:
            return {
                "merchant_id": merchant_id,
                "documents": [],
                "total": 0
            }
        
        documents = json.loads(kyb['documents'])
        return {
            "merchant_id": merchant_id,
            "documents": documents,
            "total": len(documents)
        }

@router.post("/{merchant_id}/kyb/request-additional-info")
async def request_additional_info(
    merchant_id: str,
    required_documents: List[str],
    notes: str,
    requested_by: str,
    db: asyncpg.Pool = Depends()
):
    """Request additional information from merchant"""
    async with db.acquire() as conn:
        await conn.execute("""
            UPDATE merchant_kyb_verification
            SET verification_status = 'additional_info_required',
                verification_notes = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE merchant_id = $2
        """, notes, merchant_id)
        
        # Log the request
        await conn.execute("""
            INSERT INTO merchant_kyb_requests (
                merchant_id, request_type, required_documents,
                notes, requested_by
            ) VALUES ($1, 'additional_info', $2, $3, $4)
        """, merchant_id, json.dumps(required_documents), notes, requested_by)
        
        return {
            "status": "additional_info_requested",
            "merchant_id": merchant_id,
            "required_documents": required_documents,
            "notes": notes,
            "requested_by": requested_by,
            "requested_at": datetime.now()
        }

@router.get("/kyb/pending")
async def get_pending_kyb_verifications(
    skip: int = 0,
    limit: int = 20,
    db: asyncpg.Pool = Depends()
):
    """Get list of pending KYB verifications for admin review"""
    async with db.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                k.merchant_id,
                m.business_name,
                m.business_email,
                k.verification_status,
                k.created_at,
                k.updated_at
            FROM merchant_kyb_verification k
            JOIN merchants m ON k.merchant_id = m.merchant_id
            WHERE k.verification_status IN ('pending', 'in_review', 'additional_info_required')
            ORDER BY k.created_at ASC
            LIMIT $1 OFFSET $2
        """, limit, skip)
        
        return {
            "pending_verifications": [dict(row) for row in rows],
            "total": len(rows),
            "skip": skip,
            "limit": limit
        }

# Database schema additions needed
async def create_kyb_tables(conn: asyncpg.Connection):
    """Create KYB-related tables"""
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS merchant_kyb_verification (
            id SERIAL PRIMARY KEY,
            merchant_id VARCHAR(50) REFERENCES merchants(merchant_id) ON DELETE CASCADE UNIQUE,
            verification_status VARCHAR(50) DEFAULT 'pending',
            documents JSONB,
            business_owners JSONB,
            directors JSONB,
            beneficial_owners JSONB,
            additional_info JSONB,
            verification_notes TEXT,
            verified_by VARCHAR(255),
            verified_at TIMESTAMP,
            rejection_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS merchant_risk_assessments (
            id SERIAL PRIMARY KEY,
            merchant_id VARCHAR(50) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
            risk_level VARCHAR(30) NOT NULL,
            risk_score INT NOT NULL,
            risk_factors JSONB,
            compliance_score INT,
            aml_check BOOLEAN,
            sanctions_check BOOLEAN,
            pep_check BOOLEAN,
            assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_risk_assessments_merchant ON merchant_risk_assessments(merchant_id);
        
        CREATE TABLE IF NOT EXISTS merchant_kyb_requests (
            id SERIAL PRIMARY KEY,
            merchant_id VARCHAR(50) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
            request_type VARCHAR(50) NOT NULL,
            required_documents JSONB,
            notes TEXT,
            requested_by VARCHAR(255),
            responded_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_kyb_requests_merchant ON merchant_kyb_requests(merchant_id);
    """)
