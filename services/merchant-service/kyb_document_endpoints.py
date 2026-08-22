"""
KYB Service - Document Upload Endpoints with Docling Integration
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Header
from typing import Optional, List
import logging
import tempfile
import os
import asyncpg
import json
from datetime import datetime
from docling_kyb_integration import DoclingKYBProcessor

logger = logging.getLogger("merchant-service.kyb-documents")

router = APIRouter(prefix="/api/v1/merchants/kyb/documents", tags=["KYB Documents"])

# Global instances (initialized in main.py at startup)
db_pool = None
docling_processor = None

def init_kyb_endpoints(pool: asyncpg.Pool, processor: DoclingKYBProcessor):
    """Initialize global dependencies"""
    global db_pool, docling_processor
    db_pool = pool
    docling_processor = processor

def _require_ready():
    """Fail closed when dependencies were not injected at startup."""
    if db_pool is None or docling_processor is None:
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")

@router.post("/upload/business-registration")
async def upload_business_registration(
    file: UploadFile = File(...),
    merchant_id: str = Header(..., alias="X-Merchant-ID"),
    tenant_id: str = Header(..., alias="X-Tenant-ID")
):
    """
    Upload and process CAC business registration certificate
    Automatically extracts RC number, company name, directors, etc.
    """
    _require_ready()
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
    try:
        content = await file.read()
        temp_file.write(content)
        temp_file.close()
        
        # Process document through Docling
        business_info = await docling_processor.process_business_registration(
            file_path=temp_file.name,
            tenant_id=tenant_id,
            merchant_id=merchant_id
        )
        
        # Store in database
        async with db_pool.acquire() as conn:
            document_id = f"KYB{int(datetime.now().timestamp())}"
            
            await conn.execute("""
                INSERT INTO kyb_documents (
                    document_id, merchant_id, tenant_id, document_type,
                    extracted_data, confidence_score, verification_status,
                    original_filename, processing_metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """, document_id, merchant_id, tenant_id, 'business_registration',
                json.dumps(business_info), business_info['confidence_score'],
                business_info['verification_status'], file.filename,
                json.dumps(business_info['processing_metadata']))
            
            # Update merchant KYB status
            await conn.execute("""
                UPDATE merchants
                SET kyb_status = 'in_progress', updated_at = CURRENT_TIMESTAMP
                WHERE merchant_id = $1 AND tenant_id = $2
            """, merchant_id, tenant_id)
        
        return {
            "status": "success",
            "document_id": document_id,
            "merchant_id": merchant_id,
            "document_type": "business_registration",
            "extracted_information": business_info,
            "verification_status": business_info['verification_status'],
            "confidence_score": business_info['confidence_score'],
            "processed_at": datetime.utcnow().isoformat()
        }
        
    except Exception:
        logger.exception("KYB document processing failed")
        raise HTTPException(status_code=500, detail="Document processing failed")
    finally:
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)

@router.post("/upload/tax-certificate")
async def upload_tax_certificate(
    file: UploadFile = File(...),
    merchant_id: str = Header(..., alias="X-Merchant-ID"),
    tenant_id: str = Header(..., alias="X-Tenant-ID")
):
    """
    Upload and process tax identification certificate (TIN)
    Automatically extracts TIN, company name, tax office, etc.
    """
    _require_ready()
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
    try:
        content = await file.read()
        temp_file.write(content)
        temp_file.close()
        
        tax_info = await docling_processor.process_tax_certificate(
            file_path=temp_file.name,
            tenant_id=tenant_id,
            merchant_id=merchant_id
        )
        
        async with db_pool.acquire() as conn:
            document_id = f"KYB{int(datetime.now().timestamp())}"
            
            await conn.execute("""
                INSERT INTO kyb_documents (
                    document_id, merchant_id, tenant_id, document_type,
                    extracted_data, confidence_score, verification_status,
                    original_filename, processing_metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """, document_id, merchant_id, tenant_id, 'tax_certificate',
                json.dumps(tax_info), tax_info['confidence_score'],
                tax_info['verification_status'], file.filename,
                json.dumps(tax_info['processing_metadata']))
        
        return {
            "status": "success",
            "document_id": document_id,
            "merchant_id": merchant_id,
            "document_type": "tax_certificate",
            "extracted_information": tax_info,
            "verification_status": tax_info['verification_status'],
            "confidence_score": tax_info['confidence_score'],
            "processed_at": datetime.utcnow().isoformat()
        }
        
    except Exception:
        logger.exception("KYB document processing failed")
        raise HTTPException(status_code=500, detail="Document processing failed")
    finally:
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)

@router.post("/upload/directors-id")
async def upload_directors_id(
    file: UploadFile = File(...),
    merchant_id: str = Header(..., alias="X-Merchant-ID"),
    tenant_id: str = Header(..., alias="X-Tenant-ID"),
    director_name: str = Header(..., alias="X-Director-Name")
):
    """
    Upload and process director's identity document
    Verifies director name matches the submitted document
    """
    _require_ready()
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
    try:
        content = await file.read()
        temp_file.write(content)
        temp_file.close()
        
        director_info = await docling_processor.process_directors_id(
            file_path=temp_file.name,
            tenant_id=tenant_id,
            merchant_id=merchant_id,
            director_name=director_name
        )
        
        async with db_pool.acquire() as conn:
            document_id = f"KYB{int(datetime.now().timestamp())}"
            
            await conn.execute("""
                INSERT INTO kyb_documents (
                    document_id, merchant_id, tenant_id, document_type,
                    extracted_data, confidence_score, verification_status,
                    original_filename, processing_metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """, document_id, merchant_id, tenant_id, 'directors_id',
                json.dumps(director_info), director_info['confidence_score'],
                director_info['verification_status'], file.filename,
                json.dumps(director_info['processing_metadata']))
        
        return {
            "status": "success",
            "document_id": document_id,
            "merchant_id": merchant_id,
            "document_type": "directors_id",
            "director_name": director_name,
            "extracted_information": director_info,
            "name_match": director_info['name_match'],
            "verification_status": director_info['verification_status'],
            "confidence_score": director_info['confidence_score'],
            "processed_at": datetime.utcnow().isoformat()
        }
        
    except Exception:
        logger.exception("KYB document processing failed")
        raise HTTPException(status_code=500, detail="Document processing failed")
    finally:
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)

@router.post("/upload/bank-statement")
async def upload_bank_statement(
    file: UploadFile = File(...),
    merchant_id: str = Header(..., alias="X-Merchant-ID"),
    tenant_id: str = Header(..., alias="X-Tenant-ID")
):
    """
    Upload and process business bank statement
    Automatically extracts account details, balances, transaction summary
    """
    _require_ready()
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
    try:
        content = await file.read()
        temp_file.write(content)
        temp_file.close()
        
        statement_info = await docling_processor.process_bank_statement(
            file_path=temp_file.name,
            tenant_id=tenant_id,
            merchant_id=merchant_id
        )
        
        async with db_pool.acquire() as conn:
            document_id = f"KYB{int(datetime.now().timestamp())}"
            
            await conn.execute("""
                INSERT INTO kyb_documents (
                    document_id, merchant_id, tenant_id, document_type,
                    extracted_data, confidence_score, verification_status,
                    original_filename, processing_metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """, document_id, merchant_id, tenant_id, 'bank_statement',
                json.dumps(statement_info), statement_info['confidence_score'],
                statement_info['verification_status'], file.filename,
                json.dumps(statement_info['processing_metadata']))
        
        return {
            "status": "success",
            "document_id": document_id,
            "merchant_id": merchant_id,
            "document_type": "bank_statement",
            "extracted_information": statement_info,
            "verification_status": statement_info['verification_status'],
            "confidence_score": statement_info['confidence_score'],
            "processed_at": datetime.utcnow().isoformat()
        }
        
    except Exception:
        logger.exception("KYB document processing failed")
        raise HTTPException(status_code=500, detail="Document processing failed")
    finally:
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)

@router.get("/score/{merchant_id}")
async def calculate_kyb_score(
    merchant_id: str,
    tenant_id: str
):
    """
    Calculate overall KYB verification score
    Returns score (0-100) with component breakdown and recommendations
    """
    _require_ready()
    try:
        # Get all documents for merchant
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT document_type, extracted_data, confidence_score
                FROM kyb_documents
                WHERE merchant_id = $1 AND tenant_id = $2
            """, merchant_id, tenant_id)
        
        if not rows:
            raise HTTPException(status_code=404, detail="No KYB documents found for merchant")
        
        # Parse documents
        documents = []
        for row in rows:
            doc = json.loads(row['extracted_data'])
            doc['document_type'] = row['document_type']
            doc['confidence_score'] = row['confidence_score']
            documents.append(doc)
        
        # Calculate KYB score
        kyb_score = await docling_processor.calculate_kyb_score(
            merchant_id=merchant_id,
            tenant_id=tenant_id,
            documents=documents
        )
        
        return kyb_score
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("KYB score calculation failed")
        raise HTTPException(status_code=500, detail="KYB score calculation failed")

@router.get("/list/{merchant_id}")
async def list_merchant_documents(
    merchant_id: str,
    tenant_id: str
):
    """List all KYB documents submitted by a merchant"""
    _require_ready()
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT document_id, document_type, verification_status,
                   confidence_score, original_filename, created_at
            FROM kyb_documents
            WHERE merchant_id = $1 AND tenant_id = $2
            ORDER BY created_at DESC
        """, merchant_id, tenant_id)
        
        return {
            "merchant_id": merchant_id,
            "tenant_id": tenant_id,
            "document_count": len(rows),
            "documents": [dict(row) for row in rows]
        }

@router.get("/details/{document_id}")
async def get_document_details(document_id: str):
    """Get detailed information about a specific KYB document"""
    _require_ready()
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM kyb_documents WHERE document_id = $1
        """, document_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")
        
        result = dict(row)
        if result.get('extracted_data'):
            result['extracted_data'] = json.loads(result['extracted_data'])
        if result.get('processing_metadata'):
            result['processing_metadata'] = json.loads(result['processing_metadata'])
        
        return result
