import datetime
import hashlib
import hmac
import json
import os

from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session

from services import AuditService
from schemas import AuditEventSchema, Pagination
from database import get_session
from utils import create_logger

audit_router = APIRouter()

logger = create_logger(__name__)

# CP-07/AU-03: roles allowed to run integrity verification and regulator
# exports. Ingestion authorization lives in main.py (AU-01).
_AUDIT_READER_ROLES = frozenset({
    "auditor",
    "internal-auditor",
    "compliance_officer",
    "admin",
    "tenant_admin",
    "super_admin",
    "service",
    "audit-writer",
})


def _claims_roles(request: Request) -> set:
    claims = getattr(request.state, "jwt_claims", None) or {}
    roles = set()
    role = claims.get("role")
    if isinstance(role, str):
        roles.add(role)
    for item in claims.get("roles") or []:
        roles.add(item)
    realm = claims.get("realm_access") or {}
    for item in realm.get("roles") or []:
        roles.add(item)
    return roles


def _require_audit_reader(request: Request) -> None:
    if not (_claims_roles(request) & _AUDIT_READER_ROLES):
        raise HTTPException(status_code=403, detail="audit reader role required")


def _parse_bound(value, name: str):
    if value is None:
        return None
    try:
        return datetime.datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail=f"invalid {name} timestamp")


@audit_router.post("")
def create_audit(
    payload: AuditEventSchema,
    db: Session = Depends(get_session),
):
    try:
        service = AuditService(db)
        return service.create_audit(payload)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during create_audit: {str(e)}")
        raise HTTPException(status_code=500, detail="Create audit failed.")

@audit_router.get("/tenant/{tenant_id}")
def fetch_tenant_audits(
    tenant_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_session),
):
    try:
        pagination = Pagination(page=page, limit=limit)
        service = AuditService(db)

        return service.fetch_tenant_audits(
            tenant_id=tenant_id,
            pagination=pagination,
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during fetch_tenant_audits: {str(e)}")
        raise HTTPException(status_code=500, detail="Fetch tenant audits failed.")

@audit_router.get("")
def fetch_all_audits(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_session),
):
    try:
        pagination = Pagination(page=page, limit=limit)
        service = AuditService(db)

        return service.fetch_all_audits(pagination)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during fetch_all_audits: {str(e)}")
        raise HTTPException(status_code=500, detail="Fetch all audits failed.")


@audit_router.get("/verify-chain")
def verify_chain(
    request: Request,
    tenant_id: str | None = Query(None),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None),
    db: Session = Depends(get_session),
):
    """AU-03: walk the hash chain and report tampering or gaps."""
    _require_audit_reader(request)
    from_ts = _parse_bound(from_, "from")
    to_ts = _parse_bound(to, "to")
    try:
        service = AuditService(db)
        result = service.verify_chain(tenant_id=tenant_id, from_ts=from_ts, to_ts=to_ts)
        result["tenant_id"] = tenant_id
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during verify_chain: {str(e)}")
        raise HTTPException(status_code=500, detail="Chain verification failed.")


@audit_router.get("/export")
def export_audits(
    request: Request,
    tenant_id: str = Query(...),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None),
    db: Session = Depends(get_session),
):
    """CP-07: signed regulator examination export bundle.

    Produces a JSONL audit slice plus a manifest (counts, date range, AU-03
    chain-verification result, bundle sha256) and an HMAC-SHA256 signature over
    the canonical bundle. Fails fast (503) when AUDIT_EXPORT_SECRET is unset.
    """
    secret = os.environ.get("AUDIT_EXPORT_SECRET", "")
    if not secret or secret.startswith("${"):
        # Fail-fast: an unsigned export is worthless as examination evidence.
        raise HTTPException(status_code=503, detail="audit export not configured (AUDIT_EXPORT_SECRET unset)")
    _require_audit_reader(request)
    from_ts = _parse_bound(from_, "from")
    to_ts = _parse_bound(to, "to")

    try:
        service = AuditService(db)
        rows = service.fetch_slice(tenant_id, from_ts=from_ts, to_ts=to_ts)
        chain = service.verify_chain(tenant_id=tenant_id, from_ts=from_ts, to_ts=to_ts)

        lines = []
        for row in rows:
            lines.append(json.dumps({
                "id": str(row.id),
                "actor_id": row.actor_id,
                "tenant_id": row.tenant_id,
                "event_type": row.event_type,
                "event_data": row.event_data,
                "timestamp": str(row.timestamp) if row.timestamp is not None else None,
                "created_at": str(row.created_at) if row.created_at is not None else None,
                "prev_hash": row.prev_hash,
                "entry_hash": row.entry_hash,
            }, sort_keys=True))
        audit_jsonl = "\n".join(lines) + ("\n" if lines else "")
        audit_jsonl_sha256 = hashlib.sha256(audit_jsonl.encode("utf-8")).hexdigest()

        manifest = {
            "tenant_id": tenant_id,
            "from": from_,
            "to": to,
            "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
            "record_count": len(rows),
            "audit_jsonl_sha256": audit_jsonl_sha256,
            "chain_verification": chain,
        }
        # Canonical bundle: what the signature actually covers.
        bundle = json.dumps(
            {"manifest": manifest, "audit_jsonl": audit_jsonl},
            sort_keys=True,
            separators=(",", ":"),
        )
        bundle_sha256 = hashlib.sha256(bundle.encode("utf-8")).hexdigest()
        signature = hmac.new(secret.encode("utf-8"), bundle.encode("utf-8"), hashlib.sha256).hexdigest()

        return {
            "manifest": manifest,
            "audit_jsonl": audit_jsonl,
            "bundle_sha256": bundle_sha256,
            "signature": signature,
            "signature_alg": "HMAC-SHA256",
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during export_audits: {str(e)}")
        raise HTTPException(status_code=500, detail="Audit export failed.")
