#!/usr/bin/env python3
"""PL-10: audit retention archival job (run monthly, e.g. via k8s CronJob).

Archives audit rows older than AUDIT_RETENTION_MONTHS (default 84) out of the
hot `audit` table, one bundle per (tenant_id, created_month):

  1. Export the slice to JSONL and compute the bundle sha256. The AU-03 hash
     chain of the slice is recomputed before export; a tampered slice is
     archived but flagged in the certificate (never silently dropped).
  2. Upload to s3://AUDIT_ARCHIVE_S3_BUCKET/audit/<tenant>/<month>.jsonl when
     the bucket env is set (requires boto3 in the archive image). When no S3
     bucket is configured the bundle is written to AUDIT_ARCHIVE_LOCAL_DIR
     (default /var/backups/audit) with a loud warning — local disk is NOT a
     compliant archive target.
  3. Insert a delete-after-archive certificate row into
     audit_archive_certificate (count, first/last entry_hash, bundle sha256,
     destination), then delete the archived rows — in the same transaction as
     the certificate insert, so a failed delete rolls the certificate back.

Fail-closed: any export/upload error aborts that partition BEFORE deletion.
"""
import datetime
import hashlib
import json
import logging
import os
import sys

from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("audit.archive")

DATABASE_URI = os.environ.get("DATABASE_URI", "")
RETENTION_MONTHS = int(os.environ.get("AUDIT_RETENTION_MONTHS", "84"))
S3_BUCKET = os.environ.get("AUDIT_ARCHIVE_S3_BUCKET", "")
LOCAL_DIR = os.environ.get("AUDIT_ARCHIVE_LOCAL_DIR", "/var/backups/audit")

if not DATABASE_URI:
    logger.error("DATABASE_URI is not set; aborting archival run")
    sys.exit(1)

engine = create_engine(DATABASE_URI, pool_pre_ping=True)


def _canonical(row) -> str:
    return json.dumps(
        {
            "actor_id": row.actor_id,
            "tenant_id": row.tenant_id,
            "event_type": row.event_type,
            "event_data": row.event_data,
            "timestamp": "" if row.timestamp is None else str(row.timestamp),
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def _verify_slice(rows) -> bool:
    prev = None
    for row in rows:
        if row.entry_hash is None:
            return False
        digest = hashlib.sha256(
            ((row.prev_hash or "") + _canonical(row)).encode("utf-8")
        ).hexdigest()
        if digest != row.entry_hash:
            return False
        if prev is not None and row.prev_hash != prev:
            return False
        prev = row.entry_hash
    return True


def _upload(bundle_bytes: bytes, key: str) -> str:
    if S3_BUCKET:
        try:
            import boto3  # noqa: PLC0415 — optional dependency of the archive image
        except ImportError:
            raise RuntimeError(
                "AUDIT_ARCHIVE_S3_BUCKET is set but boto3 is not installed; "
                "refusing to archive (fail-closed)"
            )
        boto3.client("s3").put_object(Bucket=S3_BUCKET, Key=key, Body=bundle_bytes)
        return f"s3://{S3_BUCKET}/{key}"
    logger.warning(
        "AUDIT_ARCHIVE_S3_BUCKET unset — writing archive bundle to LOCAL disk "
        "(%s). This is NOT a compliant archive target; configure S3.",
        LOCAL_DIR,
    )
    path = os.path.join(LOCAL_DIR, key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(bundle_bytes)
    return path


def _cutoff_month() -> str:
    today = datetime.date.today().replace(day=1)
    year = today.year
    month = today.month - RETENTION_MONTHS
    year += (month - 1) // 12
    month = (month - 1) % 12 + 1
    return f"{year:04d}-{month:02d}"


def main() -> int:
    cutoff = _cutoff_month()
    logger.info("archiving audit partitions older than %s", cutoff)
    archived = 0
    with engine.connect() as conn:
        partitions = conn.execute(
            text(
                "SELECT DISTINCT tenant_id, created_month FROM audit "
                "WHERE created_month IS NOT NULL AND created_month < :cutoff "
                "ORDER BY tenant_id, created_month"
            ),
            {"cutoff": cutoff},
        ).all()

    for tenant_id, month in partitions:
        with engine.connect() as conn:
            rows = conn.execute(
                text(
                    "SELECT id, actor_id, tenant_id, event_type, event_data, "
                    "timestamp, created_at, prev_hash, entry_hash "
                    "FROM audit WHERE tenant_id = :t AND created_month = :m "
                    "ORDER BY created_at ASC, id ASC"
                ),
                {"t": tenant_id, "m": month},
            ).all()
        if not rows:
            continue

        chain_ok = _verify_slice(rows)
        if not chain_ok:
            logger.warning(
                "chain verification FAILED for %s/%s — archiving with flag, "
                "investigate before trusting the slice",
                tenant_id,
                month,
            )
        lines = [
            json.dumps(
                {
                    "id": str(r.id),
                    "actor_id": r.actor_id,
                    "tenant_id": r.tenant_id,
                    "event_type": r.event_type,
                    "event_data": r.event_data,
                    "timestamp": None if r.timestamp is None else str(r.timestamp),
                    "created_at": None if r.created_at is None else str(r.created_at),
                    "prev_hash": r.prev_hash,
                    "entry_hash": r.entry_hash,
                },
                sort_keys=True,
            )
            for r in rows
        ]
        bundle = ("\n".join(lines) + "\n").encode("utf-8")
        bundle_sha256 = hashlib.sha256(bundle).hexdigest()
        key = f"audit/{tenant_id}/{month}.jsonl"

        try:
            destination = _upload(bundle, key)
        except Exception as exc:
            logger.error("archive upload failed for %s/%s: %s — NOT deleting rows", tenant_id, month, exc)
            continue

        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO audit_archive_certificate ("
                    " tenant_id, created_month, record_count,"
                    " first_entry_hash, last_entry_hash, bundle_sha256, destination)"
                    " VALUES (:t, :m, :c, :fh, :lh, :sha, :dest)"
                    " ON CONFLICT (tenant_id, created_month) DO NOTHING"
                ),
                {
                    "t": tenant_id,
                    "m": month,
                    "c": len(rows),
                    "fh": rows[0].entry_hash,
                    "lh": rows[-1].entry_hash,
                    "sha": bundle_sha256,
                    "dest": destination + ("" if chain_ok else " [CHAIN_VERIFICATION_FAILED]"),
                },
            )
            deleted = conn.execute(
                text(
                    "DELETE FROM audit WHERE tenant_id = :t AND created_month = :m"
                ),
                {"t": tenant_id, "m": month},
            )
        logger.info(
            "archived %s/%s: %s rows -> %s (sha256=%s, deleted=%s)",
            tenant_id, month, len(rows), destination, bundle_sha256, deleted.rowcount,
        )
        archived += 1

    logger.info("archival run complete: %s partitions archived", archived)
    return 0


if __name__ == "__main__":
    sys.exit(main())
