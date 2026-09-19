import datetime
import hashlib
import json

from sqlalchemy.orm import Session

from models import Audit
from schemas import AuditEventSchema, Pagination


# AU-03: tamper-evidence hash chain helpers.
#
# canonical(entry) is the compact, key-sorted JSON of the event fields exactly
# as persisted. entry_hash = sha256((prev_hash or "") + canonical(entry)).
# The chain is scoped per tenant and ordered by (created_at, id); the genesis
# row of each tenant chain carries prev_hash = NULL.


def _canon_ts(timestamp) -> str:
    """Normalize the persisted timestamp for hashing.

    The column is TIMESTAMP (no tz). Rows round-trip through psycopg2 as
    datetime objects whose str() is deterministic, so str() is used on both
    the write and verify paths.
    """
    if timestamp is None:
        return ""
    return str(timestamp)


def parse_timestamp(raw):
    """Parse the inbound timestamp string into a datetime for persistence."""
    if raw is None:
        return None
    if isinstance(raw, datetime.datetime):
        return raw
    try:
        return datetime.datetime.fromisoformat(str(raw).replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, TypeError):
        return None


def canonical_event(actor_id, tenant_id, event_type, event_data, timestamp) -> str:
    return json.dumps(
        {
            "actor_id": actor_id,
            "tenant_id": tenant_id,
            "event_type": event_type,
            "event_data": event_data,
            "timestamp": _canon_ts(timestamp),
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def compute_entry_hash(prev_hash, canonical: str) -> str:
    return hashlib.sha256(((prev_hash or "") + canonical).encode("utf-8")).hexdigest()


def month_of(dt: datetime.datetime) -> str:
    return dt.strftime("%Y-%m")


class AuditRepository:
    """Audit repository."""

    def __init__(self, db: Session):
        self.__db = db

    def create_audit(self, payload: AuditEventSchema):
        ts = parse_timestamp(payload.timestamp)

        # AU-03: read the current chain head for this tenant inside the same
        # transaction and lock it, so concurrent writers cannot fork the chain.
        head = (
            self.__db.query(Audit)
            .filter(Audit.tenant_id == payload.tenant_id, Audit.entry_hash.isnot(None))
            .order_by(Audit.created_at.desc(), Audit.id.desc())
            .with_for_update()
            .first()
        )
        prev_hash = head.entry_hash if head is not None else None

        audit = Audit(
            actor_id=payload.actor_id,
            tenant_id=payload.tenant_id,
            event_type=payload.event_type,
            event_data=payload.event_data,
            timestamp=ts,
        )
        # PL-10: derived retention bucket.
        audit.created_month = month_of(ts or datetime.datetime.now())
        # AU-03: seal the entry before commit (same DB transaction).
        canonical = canonical_event(
            audit.actor_id, audit.tenant_id, audit.event_type, audit.event_data, audit.timestamp
        )
        audit.prev_hash = prev_hash
        audit.entry_hash = compute_entry_hash(prev_hash, canonical)

        self.__db.add(audit)
        self.__db.commit()

        return audit

    def fetch_tenant_audits(self, tenant_id: str, pagination: Pagination):
        offset = (pagination.page - 1) * pagination.limit
        query = self.__db.query(Audit).filter(Audit.tenant_id == tenant_id)
        total = query.count()
        data = (
            query
            .order_by(Audit.timestamp.desc())
            .offset(offset)
            .limit(pagination.limit)
            .all()
        )
        return {"data": data, "total": total, "page": pagination.page, "limit": pagination.limit}

    def fetch_all_audits(self, pagination: Pagination):
        offset = (pagination.page - 1) * pagination.limit
        query = self.__db.query(Audit)
        total = query.count()
        data = (
            query
            .order_by(Audit.timestamp.desc())
            .offset(offset)
            .limit(pagination.limit)
            .all()
        )
        return {"data": data, "total": total, "page": pagination.page, "limit": pagination.limit}

    # ------------------------------------------------------------------
    # AU-03: chain verification
    # ------------------------------------------------------------------

    def _chain_query(self, tenant_id=None, from_ts=None, to_ts=None):
        query = self.__db.query(Audit).filter(Audit.deleted_at.is_(None))
        if tenant_id:
            query = query.filter(Audit.tenant_id == tenant_id)
        if from_ts is not None:
            query = query.filter(Audit.created_at >= from_ts)
        if to_ts is not None:
            query = query.filter(Audit.created_at <= to_ts)
        return query.order_by(Audit.created_at.asc(), Audit.id.asc())

    def verify_chain(self, tenant_id=None, from_ts=None, to_ts=None):
        """Walk the chain and verify every sealed entry.

        Detects (a) tampering: recomputed entry_hash differs from the stored
        value, and (b) gaps/rewrites: prev_hash differs from the entry_hash of
        the previous row in the same tenant chain. Rows written before the
        AU-03 migration that were never backfilled are reported as unsealed.
        """
        checked = 0
        unsealed = 0
        failures = []
        heads = {}  # tenant_id -> last seen entry_hash within the walked window

        for row in self._chain_query(tenant_id, from_ts, to_ts):
            if row.entry_hash is None:
                unsealed += 1
                continue
            checked += 1
            canonical = canonical_event(
                row.actor_id, row.tenant_id, row.event_type, row.event_data, row.timestamp
            )
            if compute_entry_hash(row.prev_hash, canonical) != row.entry_hash:
                failures.append({"id": str(row.id), "reason": "entry_hash mismatch (tampered)"})
            expected_prev = heads.get(row.tenant_id)
            if expected_prev is not None and row.prev_hash != expected_prev:
                failures.append({"id": str(row.id), "reason": "prev_hash mismatch (chain gap)"})
            heads[row.tenant_id] = row.entry_hash
            if len(failures) >= 20:
                break

        return {
            "valid": not failures,
            "checked": checked,
            "unsealed": unsealed,
            "failures": failures,
        }

    # ------------------------------------------------------------------
    # CP-07: export slice
    # ------------------------------------------------------------------

    def fetch_slice(self, tenant_id: str, from_ts=None, to_ts=None):
        """Ordered audit slice for the regulator export bundle."""
        return self._chain_query(tenant_id, from_ts, to_ts).all()
