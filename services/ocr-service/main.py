"""
54link-dev Docling Service
Advanced document processing with DeepSeek OCR integration
"""

import os
import asyncio
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Depends, Header
from permify_guard import require_permify  # W12-B5P1DF
from fastapi.responses import JSONResponse
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from enum import Enum
import json

# --- W12-C3P2B5: PostgreSQL persistence (replaces in-memory singleton stores) ---
# Pattern: pooled psycopg2 (fleet ref: services/inventory-py/main.py:63-116).
# PG is authoritative: create/update/delete hit Postgres transactionally
# (autocommit => each statement is its own transaction); on PG failure the
# handler returns 503. There is NO in-memory shadow that could silently
# diverge from PG (cf. failed_login_tracker anti-pattern).
import threading as _w12_threading
import psycopg2 as _w12_pg
import psycopg2.pool as _w12_pgpool
import psycopg2.extras as _w12_pgextras

_w12_pool = None
_w12_pool_lock = _w12_threading.Lock()


def _w12_get_pool():
    global _w12_pool
    if _w12_pool is None or _w12_pool.closed:
        with _w12_pool_lock:
            if _w12_pool is None or _w12_pool.closed:
                _w12_pool = _w12_pgpool.ThreadedConnectionPool(1, 10, os.environ["DATABASE_URL"])
    return _w12_pool


def _w12_run(sql, params=(), fetch="all"):
    """Run one statement on a pooled connection (autocommit = per-statement transaction)."""
    conn = _w12_get_pool().getconn()
    try:
        conn.autocommit = True
        with conn.cursor(cursor_factory=_w12_pgextras.RealDictCursor) as cur:
            cur.execute(sql, params)
            if fetch == "all":
                return cur.fetchall()
            if fetch == "one":
                return cur.fetchone()
            return cur.rowcount
    finally:
        _w12_get_pool().putconn(conn)


class _W12Store:
    """Per-domain PG table (jsonb payload pattern):
    id uuid pk default gen_random_uuid(), record_id text UNIQUE (natural key;
    upsert makes retry-able creates idempotent), tenant_id text, payload jsonb,
    created_at/updated_at timestamptz default now()."""
    _ensured = set()
    _ensured_lock = _w12_threading.Lock()

    def __init__(self, table, key="id", seed=(), tenant_key="tenant_id"):
        self.table = table
        self.key = key
        self.seed = list(seed)
        self.tenant_key = tenant_key

    def ensure(self):
        with _W12Store._ensured_lock:
            if self.table in _W12Store._ensured:
                return
            _w12_run(f"""CREATE TABLE IF NOT EXISTS {self.table} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)""", fetch=None)
            for row in self.seed:
                _rid = row.get("_rid", row.get(self.key, ""))
                _payload = {k: v for k, v in row.items() if k != "_rid"}
                _w12_run(f"""INSERT INTO {self.table} (record_id, tenant_id, payload)
VALUES (%s, %s, %s::jsonb) ON CONFLICT (record_id) DO NOTHING""",
                         (str(_rid), row.get(self.tenant_key),
                          json.dumps(_payload, default=str)), fetch=None)
            _W12Store._ensured.add(self.table)

    def all(self, limit=100000):
        self.ensure()
        return [r["payload"] for r in _w12_run(
            f"SELECT payload FROM {self.table} ORDER BY created_at, record_id LIMIT %s", (limit,))]

    def get(self, record_id):
        self.ensure()
        row = _w12_run(f"SELECT payload FROM {self.table} WHERE record_id = %s",
                       (str(record_id),), fetch="one")
        return row["payload"] if row else None

    def put(self, record_id, payload, tenant_id=None):
        self.ensure()
        _w12_run(f"""INSERT INTO {self.table} (record_id, tenant_id, payload)
VALUES (%s, %s, %s::jsonb)
ON CONFLICT (record_id) DO UPDATE
SET payload = EXCLUDED.payload, tenant_id = EXCLUDED.tenant_id, updated_at = NOW()""",
                 (str(record_id),
                  tenant_id if tenant_id is not None else payload.get(self.tenant_key),
                  json.dumps(payload, default=str)), fetch=None)

    def delete(self, record_id):
        self.ensure()
        return _w12_run(f"DELETE FROM {self.table} WHERE record_id = %s",
                        (str(record_id),), fetch=None)


def _w12_get_by(store, field, value):
    """First row whose payload field matches (jsonb ->> lookup)."""
    store.ensure()
    row = _w12_run(f"SELECT payload FROM {store.table} WHERE payload ->> %s = %s LIMIT 1",
                   (field, value), fetch="one")
    return row["payload"] if row else None


def _w12_all_by(store, field, value, limit=100000):
    """All rows whose payload field matches (jsonb ->> lookup)."""
    store.ensure()
    rows = _w12_run(
        f"SELECT payload FROM {store.table} WHERE payload ->> %s = %s ORDER BY created_at, record_id LIMIT %s",
        (field, value, limit))
    return [r["payload"] for r in rows]



class _W12PgDict:
    """Dict-like facade over a PG jsonb store — every read/write hits Postgres.
    __getitem__ returns a FRESH dict: in-place mutation of the returned dict is
    NOT persisted (use update_document_record / _doc_set)."""
    def __init__(self, store):
        self._store = store
    def __contains__(self, k):
        return self._store.get(k) is not None
    def __getitem__(self, k):
        row = self._store.get(k)
        if row is None:
            raise KeyError(k)
        return row
    def get(self, k, default=None):
        row = self._store.get(k)
        return default if row is None else row
    def __setitem__(self, k, v):
        self._store.put(k, {kk: (vv.value if isinstance(vv, Enum) else vv)
                            for kk, vv in v.items()})
    def values(self):
        return self._store.all()
    def __len__(self):
        self._store.ensure()
        return _w12_run(f"SELECT COUNT(*) AS n FROM {self._store.table}", fetch="one")["n"]

def _doc_set(document_id, **changes):
    """W12-C3P2B5: PG read-modify-write of a document record (single upsert)."""
    row = DOC_STORE.get(document_id) or {"document_id": document_id}
    row.update({k: (v.value if isinstance(v, Enum) else v) for k, v in changes.items()})
    DOC_STORE.put(document_id, row)
import structlog

from processors.docling_processor import DoclingProcessor
from processors.deepseek_processor import DeepSeekProcessor
from parsers.banking_parsers import BankingDocumentParser
from models.document import DocumentType, ProcessingStatus, DocumentResult

# Configure logging
logger = structlog.get_logger()

# Initialize FastAPI app
app = FastAPI(
    title="54Link OCR Service",
    description="Advanced document processing with DeepSeek OCR and Docling integration",
    version="1.0.0"
)
app.add_middleware(GZipMiddleware, minimum_size=1024)

# Processors are lazily initialized on first startup to avoid OOM at import time
docling_processor: Optional[DoclingProcessor] = None
deepseek_processor: Optional[DeepSeekProcessor] = None
banking_parser: Optional[BankingDocumentParser] = None

# W12-C3P2B5: PG-backed document store (table ocr_documents) via facade —
# every access hits Postgres (replaces the in-memory demo dict).
DOC_STORE = _W12Store("ocr_documents")
document_store = _W12PgDict(DOC_STORE)


@app.on_event("startup")
async def startup():
    global docling_processor, deepseek_processor, banking_parser
    logger.info("Initializing processors...")
    docling_processor = DoclingProcessor()
    deepseek_processor = DeepSeekProcessor()
    banking_parser = BankingDocumentParser()
    logger.info("Processors ready")


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

# ==================== AUTH (fail-closed) ====================

def validate_jwt(headers):
    """Validate Bearer JWT with real HS256 signature verification (stdlib).

    Fails closed: returns (None, reason) whenever the token cannot be
    cryptographically verified, is expired, is missing exp, or JWT_SECRET is
    not configured. Never warn-and-allow.
    Canonical implementation: services/shared/auth/jwt_validation.py.
    """
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = auth[7:]
    import hmac, hashlib, base64, json as _json, time as _t
    def _b64url_decode(s):
        s += "=" * (-len(s) % 4)
        return base64.urlsafe_b64decode(s.encode())
    parts = token.split(".")
    if len(parts) != 3:
        return None, "Invalid token format"
    secret = os.environ.get("JWT_SECRET", "")
    if not secret or secret.startswith("${"):
        return None, "auth_not_configured"
    try:
        header = _json.loads(_b64url_decode(parts[0]))
        payload = _json.loads(_b64url_decode(parts[1]))
        signature = _b64url_decode(parts[2])
    except Exception:
        return None, "Invalid token encoding"
    if header.get("alg") != "HS256":
        return None, "Unsupported token algorithm"
    expected = hmac.new(secret.encode(), (parts[0] + "." + parts[1]).encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, signature):
        return None, "Invalid token signature"
    exp = payload.get("exp")
    if exp is None:
        return None, "Token missing exp claim"
    try:
        if _t.time() >= float(exp):
            return None, "Token expired"
    except (TypeError, ValueError):
        return None, "Invalid token expiry"
    issuer = os.environ.get("JWT_ISSUER", "")
    if issuer and payload.get("iss") != issuer:
        return None, "Invalid token issuer"
    return payload, None


async def get_current_tenant(authorization: str = Header(None)) -> str:
    """Require a valid Bearer JWT and derive the tenant from its verified
    claims. Caller-supplied tenant headers are never trusted (fail-closed)."""
    claims, err = validate_jwt({"Authorization": authorization or ""})
    if err is not None:
        raise HTTPException(status_code=401, detail=f"Unauthorized: {err}")
    tenant_id = claims.get("tenant_id") or claims.get("tenant")
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Token missing tenant claim")
    return tenant_id


# ==================== HELPER FUNCTIONS ====================

# Maximum remote document download size (default 20 MiB)
MAX_DOCUMENT_DOWNLOAD_BYTES = int(
    os.getenv("OCR_MAX_DOWNLOAD_BYTES", str(20 * 1024 * 1024))
)
ALLOWED_DOWNLOAD_PORTS = {80, 443}


def validate_remote_document_url(url: str) -> None:
    """Validate a remote document URL before any server-side fetch (SSRF guard).

    Fails closed: raises ValueError unless the URL uses http/https on an
    allowlisted port (80/443) and every resolved address is a public IP.
    Private, loopback, link-local (e.g. 169.254.169.254 cloud metadata),
    reserved, multicast and unspecified addresses are rejected.
    """
    import ipaddress
    import socket
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL scheme must be http or https")
    host = parsed.hostname
    if not host:
        raise ValueError("URL host is required")
    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError:
        raise ValueError("URL port is invalid")
    if port not in ALLOWED_DOWNLOAD_PORTS:
        raise ValueError(f"URL port {port} is not allowed")
    try:
        addrinfos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise ValueError("URL host cannot be resolved")
    if not addrinfos:
        raise ValueError("URL host cannot be resolved")
    for info in addrinfos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise ValueError(f"URL host resolves to a non-public address ({ip})")


async def _fetch_url_capped(url: str) -> tuple:
    """Fetch a validated URL with a hard response-size cap.

    Redirects are not followed (a redirect target would bypass validation);
    callers receive the redirect as an HTTP error instead.
    Returns (content_bytes, content_type).
    """
    import httpx

    validate_remote_document_url(url)
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=False) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            content_length = response.headers.get("content-length")
            if content_length is not None:
                try:
                    if int(content_length) > MAX_DOCUMENT_DOWNLOAD_BYTES:
                        raise ValueError(
                            f"Remote document exceeds maximum size of {MAX_DOCUMENT_DOWNLOAD_BYTES} bytes"
                        )
                except ValueError as exc:
                    if "exceeds maximum size" in str(exc):
                        raise
            chunks = []
            received = 0
            async for chunk in response.aiter_bytes(65536):
                received += len(chunk)
                if received > MAX_DOCUMENT_DOWNLOAD_BYTES:
                    raise ValueError(
                        f"Remote document exceeds maximum size of {MAX_DOCUMENT_DOWNLOAD_BYTES} bytes"
                    )
                chunks.append(chunk)
            return b"".join(chunks), response.headers.get("content-type", "")


async def download_or_decode_document(content: str, document_id: str) -> str:
    """
    Download document from URL or decode base64 content
    Returns: file path to saved document
    """
    import base64
    import tempfile

    # Check if content is URL or base64
    if content.startswith(('http://', 'https://')):
        # Download from URL (SSRF-validated, size-capped)
        file_content, content_type = await _fetch_url_capped(content)

        # Determine file extension from content-type
        if 'pdf' in content_type:
            ext = '.pdf'
        elif 'image' in content_type:
            ext = '.jpg'
        else:
            ext = '.bin'
    else:
        # Decode base64
        try:
            file_content = base64.b64decode(content)
            ext = '.pdf'  # Default to PDF
        except Exception:
            raise ValueError("Invalid base64 content")
    
    # Save to temporary file
    temp_dir = tempfile.gettempdir()
    file_path = os.path.join(temp_dir, f"{document_id}{ext}")
    
    with open(file_path, 'wb') as f:
        f.write(file_content)
    
    logger.info(f"Saved document to {file_path}")
    return file_path

# ==================== REQUEST/RESPONSE MODELS ====================

class DocumentUploadResponse(BaseModel):
    document_id: str
    status: str
    message: str
    estimated_processing_time: int  # seconds

class DocumentStatusResponse(BaseModel):
    document_id: str
    status: ProcessingStatus
    progress: int  # 0-100
    result: Optional[DocumentResult] = None
    error: Optional[str] = None

class BatchUploadRequest(BaseModel):
    documents: List[str]  # List of document URLs or base64 encoded content
    document_type: Optional[DocumentType] = None
    tenant_id: str


# ==================== BACKGROUND PROCESSING ====================

async def process_document_async(
    document_id: str,
    file_path: str,
    document_type: Optional[DocumentType],
    tenant_id: str
):
    """
    Background task for asynchronous document processing
    """
    try:
        # Update status to processing
        _doc_set(document_id, status=ProcessingStatus.PROCESSING)
        _doc_set(document_id, progress=10)
        
        logger.info(f"Starting processing for document {document_id}")
        
        # Step 1: Detect document type if not provided
        if not document_type:
            document_type = await docling_processor.detect_document_type(file_path)
            _doc_set(document_id, document_type=document_type)
            _doc_set(document_id, progress=20)
        
        # Step 2: Process with Docling
        docling_result = await docling_processor.process_document(
            file_path=file_path,
            document_type=document_type
        )
        _doc_set(document_id, progress=50)
        
        # Step 3: Enhance with DeepSeek OCR if needed
        if docling_result.get("requires_ocr", False):
            deepseek_result = await deepseek_processor.process_document(
                file_path=file_path,
                docling_context=docling_result
            )
            # Merge results
            docling_result["text"] = deepseek_result.get("text", docling_result.get("text"))
            docling_result["confidence"] = deepseek_result.get("confidence", docling_result.get("confidence"))
        
        _doc_set(document_id, progress=70)
        
        # Step 4: Parse banking-specific fields
        if document_type in [DocumentType.NATIONAL_ID, DocumentType.PASSPORT, 
                            DocumentType.DRIVERS_LICENSE, DocumentType.BANK_STATEMENT]:
            parsed_fields = banking_parser.parse_document(
                text=docling_result.get("text", ""),
                document_type=document_type,
                structured_data=docling_result.get("tables", [])
            )
            docling_result["parsed_fields"] = parsed_fields
        
        _doc_set(document_id, progress=90)
        
        # Step 5: Store results
        result = DocumentResult(
            document_id=document_id,
            document_type=document_type,
            text=docling_result.get("text", ""),
            confidence=docling_result.get("confidence", 0.0),
            parsed_fields=docling_result.get("parsed_fields", {}),
            tables=docling_result.get("tables", []),
            images=docling_result.get("images", []),
            metadata=docling_result.get("metadata", {}),
            processing_time_ms=docling_result.get("processing_time_ms", 0)
        )
        
        _doc_set(document_id, status=ProcessingStatus.COMPLETED)
        _doc_set(document_id, progress=100)
        _doc_set(document_id, result=result.dict())
        _doc_set(document_id, completed_at=datetime.utcnow().isoformat())
        
        logger.info(f"Completed processing for document {document_id}")
        
    except Exception as e:
        logger.error(f"Error processing document {document_id}: {str(e)}")
        _doc_set(document_id, status=ProcessingStatus.FAILED)
        _doc_set(document_id, error=str(e))


# ==================== API ENDPOINTS ====================

@app.post("/api/v1/documents/upload", response_model=DocumentUploadResponse, dependencies=[Depends(require_permify("document", "upload"))])
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_type: Optional[DocumentType] = None,
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Upload and process a document
    
    Supports: PDF, DOCX, PPTX, XLSX, images (PNG, JPEG, TIFF)
    """
    try:
        # Generate document ID
        document_id = str(uuid.uuid4())
        
        # Validate file type
        allowed_extensions = ['.pdf', '.docx', '.pptx', '.xlsx', '.png', '.jpg', '.jpeg', '.tiff']

        filename = getattr(file, "filename", None) or getattr(file, "name", None)
        if not filename:
            return None

        file_ext = os.path.splitext(filename)[1].lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_ext}. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Save file temporarily
        file_path = f"{os.getenv('TMP_PATH', '/tmp')}/docling_{document_id}{file_ext}"
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Initialize document record
        document_store[document_id] = {
            "document_id": document_id,
            "filename": file.filename,
            "file_path": file_path,
            "document_type": document_type,
            "tenant_id": tenant_id,
            "status": ProcessingStatus.QUEUED,
            "progress": 0,
            "created_at": datetime.utcnow().isoformat(),
            "result": None,
            "error": None
        }

        logger.info(f"Uploaded document {document_id} by tenant {tenant_id}")
        
        # Start background processing
        background_tasks.add_task(
            process_document_async,
            document_id=document_id,
            file_path=file_path,
            document_type=document_type,
            tenant_id=tenant_id
        )
        
        # Estimate processing time based on file size
        file_size_mb = len(content) / (1024 * 1024)
        estimated_time = int(file_size_mb * 10) + 5  # ~10 seconds per MB + 5 seconds overhead
        
        return DocumentUploadResponse(
            document_id=document_id,
            status="queued",
            message=f"Document {file.filename} uploaded successfully and queued for processing",
            estimated_processing_time=estimated_time
        )
        
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/api/v1/documents/{document_id}/status", response_model=DocumentStatusResponse, dependencies=[Depends(require_permify("document", "view"))])
async def get_document_status(
    document_id: str,
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Get processing status and results for a document
    """
    if document_id not in document_store:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc = document_store[document_id]
    
    # Verify tenant access
    if doc["tenant_id"] != tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return DocumentStatusResponse(
        document_id=document_id,
        status=doc["status"],
        progress=doc["progress"],
        result=doc.get("result"),
        error=doc.get("error")
    )


@app.get("/api/v1/documents/{document_id}/result", dependencies=[Depends(require_permify("document", "view"))])
async def get_document_result(
    document_id: str,
    format: str = "json",  # json, markdown, html
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Get document processing result in specified format
    """
    if document_id not in document_store:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc = document_store[document_id]
    
    # Verify tenant access
    if doc["tenant_id"] != tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if doc["status"] != ProcessingStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Document processing not completed. Current status: {doc['status']}"
        )
    
    result = doc["result"]
    
    if format == "json":
        return JSONResponse(content=result)
    elif format == "markdown":
        # Convert to markdown
        markdown_content = f"# Document: {doc['filename']}\n\n"
        markdown_content += f"## Extracted Text\n\n{result['text']}\n\n"
        if result.get("parsed_fields"):
            markdown_content += "## Parsed Fields\n\n"
            for key, value in result["parsed_fields"].items():
                markdown_content += f"- **{key}**: {value}\n"
        return {"content": markdown_content, "format": "markdown"}
    elif format == "html":
        # Convert to HTML
        html_content = f"<h1>Document: {doc['filename']}</h1>"
        html_content += f"<h2>Extracted Text</h2><p>{result['text']}</p>"
        if result.get("parsed_fields"):
            html_content += "<h2>Parsed Fields</h2><ul>"
            for key, value in result["parsed_fields"].items():
                html_content += f"<li><strong>{key}</strong>: {value}</li>"
            html_content += "</ul>"
        return {"content": html_content, "format": "html"}
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")


@app.post("/api/v1/documents/batch", dependencies=[Depends(require_permify("document", "batch"))])
async def batch_upload(
    request: BatchUploadRequest,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(get_current_tenant)
):
    """
    Upload and process multiple documents in batch.

    Requires a valid Bearer JWT. The tenant is derived from verified token
    claims; a body-supplied tenant_id that does not match the token tenant
    is rejected (fail-closed) to prevent cross-tenant access to results.
    """
    if request.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Tenant mismatch with authenticated identity")
    document_ids = []
    
    for doc_content in request.documents:
        document_id = str(uuid.uuid4())
        document_ids.append(document_id)
        
        try:
            # Download document from URL or decode base64
            file_path = await download_or_decode_document(doc_content, document_id)
            
            # Queue the processing
            document_store[document_id] = {
                "document_id": document_id,
                "status": ProcessingStatus.QUEUED,
                "tenant_id": request.tenant_id,
                "created_at": datetime.utcnow().isoformat(),
                "file_path": file_path
            }
            
            # Start background processing
            background_tasks.add_task(
                process_document_async,
                document_id,
                file_path,
                request.document_type,
                request.tenant_id
            )
            
        except Exception as e:
            logger.error(f"Failed to download/decode document: {str(e)}")
            document_store[document_id] = {
                "document_id": document_id,
                "status": ProcessingStatus.FAILED,
                "tenant_id": request.tenant_id,
                "error": f"Download failed: {str(e)}",
                "created_at": datetime.utcnow().isoformat()
            }
    
    return {
        "batch_id": str(uuid.uuid4()),
        "document_ids": document_ids,
        "total_documents": len(document_ids),
        "message": "Batch processing initiated"
    }


@app.get("/api/v1/health", dependencies=[Depends(require_permify("document", "view"))])
async def health_check():
    """
    Health check endpoint
    """
    return {
        "status": "healthy",
        "service": "docling-service",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "processors": {
            "docling": "ready",
            "deepseek": "ready"
        }
    }


@app.get("/api/v1/metrics", dependencies=[Depends(require_permify("document", "view"))])
async def get_metrics():
    """
    Get service metrics
    """
    total_documents = len(document_store)
    completed = sum(1 for doc in document_store.values() if doc["status"] == ProcessingStatus.COMPLETED)
    failed = sum(1 for doc in document_store.values() if doc["status"] == ProcessingStatus.FAILED)
    processing = sum(1 for doc in document_store.values() if doc["status"] == ProcessingStatus.PROCESSING)
    queued = sum(1 for doc in document_store.values() if doc["status"] == ProcessingStatus.QUEUED)
    
    return {
        "total_documents": total_documents,
        "completed": completed,
        "failed": failed,
        "processing": processing,
        "queued": queued,
        "success_rate": (completed / total_documents * 100) if total_documents > 0 else 0
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8026)), workers=int(os.environ.get("UVICORN_WORKERS", "4")))