"""
54link-dev Docling Service
Advanced document processing with DeepSeek OCR integration
"""

import os
import json
import asyncio
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import structlog

try:
    from processors.docling_processor import DoclingProcessor
except ModuleNotFoundError:
    DoclingProcessor = None

try:
    from processors.deepseek_processor import DeepSeekProcessor
except ModuleNotFoundError:
    DeepSeekProcessor = None

try:
    from parsers.banking_parsers import BankingDocumentParser
except ModuleNotFoundError:
    BankingDocumentParser = None
from api.models.document import DocumentType, ProcessingStatus, DocumentResult
from api.middleware.auth import get_current_tenant

# Configure logging
logger = structlog.get_logger()

# Initialize FastAPI app
app = FastAPI(
    title="54link-dev Docling Service",
    description="Advanced document processing with DeepSeek OCR and Docling integration",
    version="1.0.0"
)

# Initialize processors
docling_processor = DoclingProcessor() if DoclingProcessor is not None else None
deepseek_processor = DeepSeekProcessor() if DeepSeekProcessor is not None else None
banking_parser = BankingDocumentParser() if BankingDocumentParser is not None else None

def docling_dependencies_available() -> bool:
    return docling_processor is not None and deepseek_processor is not None and banking_parser is not None

def ensure_docling_dependencies():
    if not docling_dependencies_available():
        raise HTTPException(
            status_code=503,
            detail="Docling processing dependencies are not installed. Install the docling processor stack to enable advanced document processing."
        )

# Persistent metadata store for document processing state
DOCUMENT_STORE_PATH = os.getenv("DOCLING_DOCUMENT_STORE_PATH", "/tmp/54link-dev_docling_document_store.json")
document_store: Dict[str, Dict[str, Any]] = {}


def _normalize_document_store_for_write(store: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    normalized: Dict[str, Dict[str, Any]] = {}
    for document_id, payload in store.items():
        normalized_payload: Dict[str, Any] = {}
        for key, value in payload.items():
            if isinstance(value, Enum):
                normalized_payload[key] = value.value
            else:
                normalized_payload[key] = value
        normalized[document_id] = normalized_payload
    return normalized


def load_document_store() -> Dict[str, Dict[str, Any]]:
    if not os.path.exists(DOCUMENT_STORE_PATH):
        return {}
    try:
        with open(DOCUMENT_STORE_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict):
            return data
    except Exception as exc:
        logger.warning("Failed to load persistent document store", error=str(exc), path=DOCUMENT_STORE_PATH)
    return {}


def persist_document_store() -> None:
    directory = os.path.dirname(DOCUMENT_STORE_PATH)
    if directory:
        os.makedirs(directory, exist_ok=True)
    tmp_path = f"{DOCUMENT_STORE_PATH}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as handle:
        json.dump(_normalize_document_store_for_write(document_store), handle, ensure_ascii=False, indent=2)
    os.replace(tmp_path, DOCUMENT_STORE_PATH)


def update_document_record(document_id: str, **changes: Any) -> None:
    if document_id not in document_store:
        document_store[document_id] = {"document_id": document_id}
    document_store[document_id].update(changes)
    persist_document_store()


document_store = load_document_store()

LAKEHOUSE_API_URL = os.getenv("LAKEHOUSE_API_URL", "http://lakehouse-api:8000")


# ==================== HELPER FUNCTIONS ====================

async def download_or_decode_document(content: str, document_id: str) -> str:
    """
    Download document from URL or decode base64 content
    Returns: file path to saved document
    """
    import base64
    import httpx
    import tempfile
    
    # Check if content is URL or base64
    if content.startswith(('http://', 'https://')):
        # Download from URL
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(content)
            response.raise_for_status()
            file_content = response.content
            
            # Determine file extension from content-type
            content_type = response.headers.get('content-type', '')
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


# ==================== LAKEHOUSE INTEGRATION ====================

async def send_to_lakehouse(result: DocumentResult, tenant_id: str, document_id: str):
    """
    Send processed document to the lakehouse through the shared publisher.
    """
    try:
        import sys

        shared_python = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../shared/python"))
        if shared_python not in sys.path:
            sys.path.insert(0, shared_python)

        from services.common.lakehouse.lakehouse_publisher import LakehousePublisher

        publisher = LakehousePublisher(
            service_name="docling-service",
            table_name="bronze.docling_documents",
        )

        payload = {
            "document_id": document_id,
            "tenant_id": tenant_id,
            "document_type": str(result.document_type),
            "text": result.text,
            "confidence": result.confidence,
            "parsed_fields": result.parsed_fields,
            "tables": result.tables,
            "images": result.images,
            "metadata": result.metadata,
            "processing_time_ms": result.processing_time_ms,
            "lakehouse_api_url": LAKEHOUSE_API_URL,
            "published_at": datetime.utcnow().isoformat(),
        }

        success = publisher.publish_event(
            event_type="DOCUMENT_PROCESSED",
            payload=payload,
            tenant_id=tenant_id,
            entity_id=document_id,
            entity_type="document",
        )
        if not success:
            raise RuntimeError("shared lakehouse publisher returned failure")

        logger.info(f"Sent document {document_id} to lakehouse")

    except Exception as e:
        logger.error(f"Failed to send document to lakehouse: {str(e)}")
        raise

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
        ensure_docling_dependencies()

        # Update status to processing
        update_document_record(document_id, status=ProcessingStatus.PROCESSING, progress=10)
        
        logger.info(f"Starting processing for document {document_id}")
        
        # Step 1: Detect document type if not provided
        if not document_type:
            document_type = await docling_processor.detect_document_type(file_path)
            update_document_record(document_id, document_type=document_type, progress=20)
        
        # Step 2: Process with Docling
        docling_result = await docling_processor.process_document(
            file_path=file_path,
            document_type=document_type
        )
        update_document_record(document_id, progress=50)
        
        # Step 3: Enhance with DeepSeek OCR if needed
        if docling_result.get("requires_ocr", False):
            deepseek_result = await deepseek_processor.process_document(
                file_path=file_path,
                docling_context=docling_result
            )
            # Merge results
            docling_result["text"] = deepseek_result.get("text", docling_result.get("text"))
            docling_result["confidence"] = deepseek_result.get("confidence", docling_result.get("confidence"))
        
        update_document_record(document_id, progress=70)
        
        # Step 4: Parse banking-specific fields
        if document_type in [DocumentType.NATIONAL_ID, DocumentType.PASSPORT, 
                            DocumentType.DRIVERS_LICENSE, DocumentType.BANK_STATEMENT]:
            parsed_fields = banking_parser.parse_document(
                text=docling_result.get("text", ""),
                document_type=document_type,
                structured_data=docling_result.get("tables", [])
            )
            docling_result["parsed_fields"] = parsed_fields
        
        update_document_record(document_id, progress=90)
        
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
        
        update_document_record(
            document_id,
            status=ProcessingStatus.COMPLETED,
            progress=100,
            result=result.dict(),
            completed_at=datetime.utcnow().isoformat()
        )
        
        logger.info(f"Completed processing for document {document_id}")
        
        # Send to lakehouse for storage and feature extraction
        try:
            await send_to_lakehouse(result, tenant_id, document_id)
        except Exception as lakehouse_error:
            logger.warning(f"Failed to send document to lakehouse: {lakehouse_error}")
            # Don't fail the entire processing if lakehouse ingestion fails
        
    except Exception as e:
        logger.error(f"Error processing document {document_id}: {str(e)}")
        update_document_record(document_id, status=ProcessingStatus.FAILED, error=str(e))


# ==================== API ENDPOINTS ====================

@app.post("/api/v1/documents/upload", response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_type: Optional[DocumentType] = None,
    tenant_id: str = Depends(get_current_tenant)
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
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_ext}. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Save file temporarily
        file_path = f"/tmp/docling_{document_id}{file_ext}"
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Initialize document record
        update_document_record(
            document_id,
            filename=file.filename,
            file_path=file_path,
            document_type=document_type,
            tenant_id=tenant_id,
            status=ProcessingStatus.QUEUED,
            progress=0,
            created_at=datetime.utcnow().isoformat(),
            result=None,
            error=None
        )
        
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


@app.get("/api/v1/documents/{document_id}/status", response_model=DocumentStatusResponse)
async def get_document_status(
    document_id: str,
    tenant_id: str = Depends(get_current_tenant)
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


@app.get("/api/v1/documents/{document_id}/result")
async def get_document_result(
    document_id: str,
    format: str = "json",  # json, markdown, html
    tenant_id: str = Depends(get_current_tenant)
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


@app.post("/api/v1/documents/batch")
async def batch_upload(
    request: BatchUploadRequest,
    background_tasks: BackgroundTasks
):
    """
    Upload and process multiple documents in batch
    """
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


@app.get("/api/v1/health")
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


@app.get("/api/v1/metrics")
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
    uvicorn.run(app, host="0.0.0.0", port=8000)
