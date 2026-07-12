#!/bin/bash
# Comprehensive Docling Service Implementation Script

cd /home/ubuntu/54link-dev-unified-platform/services/docling-service

# Create all necessary component files
echo "Creating Docling service components..."

# Models
cat > api/models/__init__.py << 'EOF'
from .document import *
EOF

cat > api/models/document.py << 'EOF'
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class DocumentType(str, Enum):
    NATIONAL_ID = "national_id"
    PASSPORT = "passport"
    DRIVERS_LICENSE = "drivers_license"
    BANK_STATEMENT = "bank_statement"
    UTILITY_BILL = "utility_bill"
    CORPORATE_REGISTRATION = "corporate_registration"
    TAX_DOCUMENT = "tax_document"
    LOAN_APPLICATION = "loan_application"
    FINANCIAL_STATEMENT = "financial_statement"
    UNKNOWN = "unknown"

class ProcessingStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class DocumentResult(BaseModel):
    document_id: str
    document_type: DocumentType
    text: str
    confidence: float = Field(ge=0.0, le=1.0)
    parsed_fields: Dict[str, Any] = {}
    tables: List[Dict[str, Any]] = []
    images: List[str] = []
    metadata: Dict[str, Any] = {}
    processing_time_ms: int
EOF

# Middleware
cat > api/middleware/__init__.py << 'EOF'
from .auth import *
EOF

cat > api/middleware/auth.py << 'EOF'
from fastapi import Header, HTTPException

async def get_current_tenant(x_tenant_id: str = Header(...)) -> str:
    """Extract tenant ID from request header"""
    if not x_tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    return x_tenant_id
EOF

# Docling Processor
cat > processors/__init__.py << 'EOF'
from .docling_processor import DoclingProcessor
from .deepseek_processor import DeepSeekProcessor
EOF

cat > processors/docling_processor.py << 'EOF'
"""
Docling Document Processor
Handles multi-format document processing with advanced PDF understanding
"""

import os
import time
from typing import Dict, Any, Optional
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from api.models.document import DocumentType
import structlog

logger = structlog.get_logger()

class DoclingProcessor:
    def __init__(self):
        self.converter = DocumentConverter()
        
    async def detect_document_type(self, file_path: str) -> DocumentType:
        """Detect document type from content"""
        # Simple heuristic based on filename and content
        filename = os.path.basename(file_path).lower()
        
        if any(x in filename for x in ['passport', 'international']):
            return DocumentType.PASSPORT
        elif any(x in filename for x in ['license', 'driver']):
            return DocumentType.DRIVERS_LICENSE
        elif any(x in filename for x in ['statement', 'bank']):
            return DocumentType.BANK_STATEMENT
        elif any(x in filename for x in ['utility', 'bill', 'nepa', 'phcn']):
            return DocumentType.UTILITY_BILL
        elif any(x in filename for x in ['cac', 'registration', 'corporate']):
            return DocumentType.CORPORATE_REGISTRATION
        elif any(x in filename for x in ['tax', 'tin', 'firs']):
            return DocumentType.TAX_DOCUMENT
        elif any(x in filename for x in ['loan', 'application']):
            return DocumentType.LOAN_APPLICATION
        elif any(x in filename for x in ['financial', 'balance', 'income']):
            return DocumentType.FINANCIAL_STATEMENT
        else:
            return DocumentType.UNKNOWN
    
    async def process_document(
        self,
        file_path: str,
        document_type: Optional[DocumentType] = None
    ) -> Dict[str, Any]:
        """
        Process document with Docling
        """
        start_time = time.time()
        
        try:
            # Convert document
            result = self.converter.convert(file_path)
            
            # Extract text
            text = result.document.export_to_markdown()
            
            # Extract tables
            tables = []
            if hasattr(result.document, 'tables'):
                for table in result.document.tables:
                    tables.append({
                        "rows": table.num_rows if hasattr(table, 'num_rows') else 0,
                        "cols": table.num_cols if hasattr(table, 'num_cols') else 0,
                        "data": str(table)
                    })
            
            # Extract images
            images = []
            if hasattr(result.document, 'pictures'):
                images = [str(img) for img in result.document.pictures]
            
            # Check if OCR is needed (scanned document)
            requires_ocr = self._check_if_scanned(text)
            
            processing_time = int((time.time() - start_time) * 1000)
            
            return {
                "text": text,
                "confidence": 0.95 if not requires_ocr else 0.70,
                "tables": tables,
                "images": images,
                "requires_ocr": requires_ocr,
                "metadata": {
                    "page_count": result.document.page_count if hasattr(result.document, 'page_count') else 1,
                    "format": os.path.splitext(file_path)[1]
                },
                "processing_time_ms": processing_time
            }
            
        except Exception as e:
            logger.error(f"Docling processing failed: {str(e)}")
            raise
    
    def _check_if_scanned(self, text: str) -> bool:
        """Check if document appears to be scanned (low text extraction)"""
        return len(text.strip()) < 100
EOF

# DeepSeek Processor
cat > processors/deepseek_processor.py << 'EOF'
"""
DeepSeek OCR Processor
Enhanced OCR with context optical compression
"""

import os
import base64
import httpx
from typing import Dict, Any
import structlog

logger = structlog.get_logger()

class DeepSeekProcessor:
    def __init__(self):
        self.api_key = os.getenv("DEEPSEEK_API_KEY", "")
        self.api_url = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")
        
    async def process_document(
        self,
        file_path: str,
        docling_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process document with DeepSeek OCR
        """
        if not self.api_key:
            logger.warning("DeepSeek API key not configured, using fallback")
            return self._fallback_ocr(file_path)
        
        try:
            # Read and encode image
            with open(file_path, "rb") as f:
                image_data = base64.b64encode(f.read()).decode('utf-8')
            
            # Prepare request
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.api_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "deepseek-chat",
                        "messages": [
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:image/jpeg;base64,{image_data}"
                                        }
                                    },
                                    {
                                        "type": "text",
                                        "text": "Extract all text from this document, preserving structure and layout. Include tables, forms, and any handwritten text."
                                    }
                                ]
                            }
                        ]
                    }
                )
            
            if response.status_code == 200:
                result = response.json()
                text = result["choices"][0]["message"]["content"]
                
                return {
                    "text": text,
                    "confidence": 0.98,
                    "method": "deepseek_ocr"
                }
            else:
                logger.error(f"DeepSeek API error: {response.status_code}")
                return self._fallback_ocr(file_path)
                
        except Exception as e:
            logger.error(f"DeepSeek OCR failed: {str(e)}")
            return self._fallback_ocr(file_path)
    
    def _fallback_ocr(self, file_path: str) -> Dict[str, Any]:
        """Fallback to Tesseract OCR"""
        try:
            import pytesseract
            from PIL import Image
            
            image = Image.open(file_path)
            text = pytesseract.image_to_string(image)
            
            return {
                "text": text,
                "confidence": 0.85,
                "method": "tesseract_fallback"
            }
        except Exception as e:
            logger.error(f"Fallback OCR failed: {str(e)}")
            return {
                "text": "",
                "confidence": 0.0,
                "method": "none"
            }
EOF

# Banking Parsers
cat > parsers/__init__.py << 'EOF'
from .banking_parsers import BankingDocumentParser
EOF

cat > parsers/banking_parsers.py << 'EOF'
"""
Banking Document Parsers
Nigerian-specific document field extraction
"""

import re
from typing import Dict, Any, List
from api.models.document import DocumentType

class BankingDocumentParser:
    def parse_document(
        self,
        text: str,
        document_type: DocumentType,
        structured_data: List[Dict[str, Any]] = []
    ) -> Dict[str, Any]:
        """Parse banking document based on type"""
        
        if document_type == DocumentType.NATIONAL_ID:
            return self._parse_national_id(text)
        elif document_type == DocumentType.PASSPORT:
            return self._parse_passport(text)
        elif document_type == DocumentType.DRIVERS_LICENSE:
            return self._parse_drivers_license(text)
        elif document_type == DocumentType.BANK_STATEMENT:
            return self._parse_bank_statement(text, structured_data)
        elif document_type == DocumentType.UTILITY_BILL:
            return self._parse_utility_bill(text)
        elif document_type == DocumentType.CORPORATE_REGISTRATION:
            return self._parse_corporate_registration(text)
        else:
            return {"raw_text": text}
    
    def _parse_national_id(self, text: str) -> Dict[str, str]:
        """Parse Nigerian National ID"""
        fields = {}
        
        # ID number (11 digits)
        id_match = re.search(r'\b\d{11}\b', text)
        if id_match:
            fields['id_number'] = id_match.group()
        
        # Name
        name_match = re.search(r'(?:Name|SURNAME)[:\s]+([A-Z\s]+)', text, re.IGNORECASE)
        if name_match:
            fields['name'] = name_match.group(1).strip()
        
        # Date of birth
        dob_match = re.search(r'(?:Date of Birth|DOB)[:\s]+(\d{2}[/-]\d{2}[/-]\d{4})', text, re.IGNORECASE)
        if dob_match:
            fields['date_of_birth'] = dob_match.group(1)
        
        # Gender
        gender_match = re.search(r'(?:Sex|Gender)[:\s]+(Male|Female|M|F)', text, re.IGNORECASE)
        if gender_match:
            fields['gender'] = gender_match.group(1)
        
        return fields
    
    def _parse_passport(self, text: str) -> Dict[str, str]:
        """Parse Nigerian Passport"""
        fields = {}
        
        # Passport number (A + 8 digits)
        passport_match = re.search(r'\bA\d{8}\b', text)
        if passport_match:
            fields['passport_number'] = passport_match.group()
        
        # Surname
        surname_match = re.search(r'(?:Surname|SURNAME)[:\s]+([A-Z]+)', text)
        if surname_match:
            fields['surname'] = surname_match.group(1)
        
        # Given names
        given_match = re.search(r'(?:Given names|GIVEN NAMES)[:\s]+([A-Z\s]+)', text)
        if given_match:
            fields['given_names'] = given_match.group(1).strip()
        
        # Nationality
        fields['nationality'] = 'NIGERIAN' if 'NIGERIA' in text.upper() else 'Unknown'
        
        return fields
    
    def _parse_drivers_license(self, text: str) -> Dict[str, str]:
        """Parse Driver's License"""
        fields = {}
        
        # License number
        license_match = re.search(r'(?:License No|LICENSE NUMBER)[:\s]+([A-Z0-9]+)', text, re.IGNORECASE)
        if license_match:
            fields['license_number'] = license_match.group(1)
        
        # Expiry date
        expiry_match = re.search(r'(?:Expiry|EXPIRY DATE)[:\s]+(\d{2}[/-]\d{2}[/-]\d{4})', text, re.IGNORECASE)
        if expiry_match:
            fields['expiry_date'] = expiry_match.group(1)
        
        return fields
    
    def _parse_bank_statement(self, text: str, tables: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Parse Bank Statement"""
        fields = {}
        
        # Account number
        account_match = re.search(r'(?:Account|A/C)[:\s]+(\d{10})', text, re.IGNORECASE)
        if account_match:
            fields['account_number'] = account_match.group(1)
        
        # Account name
        name_match = re.search(r'(?:Account Name|Name)[:\s]+([A-Z\s]+)', text, re.IGNORECASE)
        if name_match:
            fields['account_name'] = name_match.group(1).strip()
        
        # Extract transactions from tables
        if tables:
            fields['transactions'] = tables[0] if tables else []
        
        return fields
    
    def _parse_utility_bill(self, text: str) -> Dict[str, str]:
        """Parse Utility Bill"""
        fields = {}
        
        # Address
        address_match = re.search(r'(?:Address|CUSTOMER ADDRESS)[:\s]+(.+?)(?:\n|$)', text, re.IGNORECASE)
        if address_match:
            fields['address'] = address_match.group(1).strip()
        
        # Account number
        account_match = re.search(r'(?:Account|Customer) (?:No|Number)[:\s]+(\d+)', text, re.IGNORECASE)
        if account_match:
            fields['account_number'] = account_match.group(1)
        
        return fields
    
    def _parse_corporate_registration(self, text: str) -> Dict[str, str]:
        """Parse Corporate Registration (CAC)"""
        fields = {}
        
        # RC number
        rc_match = re.search(r'(?:RC|Registration)[:\s]+(\d+)', text, re.IGNORECASE)
        if rc_match:
            fields['rc_number'] = rc_match.group(1)
        
        # Company name
        company_match = re.search(r'(?:Company Name|Name of Company)[:\s]+(.+?)(?:\n|$)', text, re.IGNORECASE)
        if company_match:
            fields['company_name'] = company_match.group(1).strip()
        
        return fields
EOF

echo "All Docling service components created successfully!"
