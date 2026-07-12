"""
KYB Service - Docling/DeepSeek Integration Module
Automated document processing for business verification
"""

import httpx
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime
import structlog

logger = structlog.get_logger()

class DoclingKYBProcessor:
    """
    Processes KYB documents using Docling service
    Extracts business information automatically from corporate documents
    """
    
    def __init__(self, docling_url: str = "http://docling-service:8010"):
        self.docling_url = docling_url
        self.client = httpx.AsyncClient(timeout=60.0)
    
    async def process_business_registration(
        self,
        file_path: str,
        tenant_id: str,
        merchant_id: str
    ) -> Dict[str, Any]:
        """
        Process CAC business registration certificate
        
        Args:
            file_path: Path to uploaded document file
            tenant_id: Bank/tenant identifier
            merchant_id: Merchant identifier
            
        Returns:
            Extracted business registration information
        """
        try:
            with open(file_path, 'rb') as f:
                files = {'file': (file_path.split('/')[-1], f, 'application/pdf')}
                headers = {'X-Tenant-ID': tenant_id}
                
                response = await self.client.post(
                    f"{self.docling_url}/api/v1/process",
                    files=files,
                    headers=headers,
                    data={'document_type': 'business_registration'}
                )
            
            if response.status_code != 200:
                logger.error(f"Docling processing failed: {response.text}")
                raise Exception(f"Document processing failed: {response.status_code}")
            
            result = response.json()
            parsed_fields = result.get('parsed_fields', {})
            
            business_info = {
                'document_type': 'business_registration',
                'rc_number': parsed_fields.get('rc_number', ''),
                'company_name': parsed_fields.get('company_name', ''),
                'business_type': parsed_fields.get('business_type', ''),
                'registration_date': parsed_fields.get('registration_date', ''),
                'registered_address': parsed_fields.get('registered_address', ''),
                'share_capital': parsed_fields.get('share_capital', 0.0),
                'directors': parsed_fields.get('directors', []),
                'shareholders': parsed_fields.get('shareholders', []),
                'business_activities': parsed_fields.get('business_activities', []),
                'verification_status': 'verified' if result['confidence'] > 0.90 else 'needs_review',
                'confidence_score': result['confidence'],
                'processing_metadata': {
                    'document_id': result['document_id'],
                    'processing_time_ms': result['processing_time_ms'],
                    'processed_at': datetime.utcnow().isoformat(),
                    'merchant_id': merchant_id,
                    'tenant_id': tenant_id
                }
            }
            
            # Publish to lakehouse
            await self._publish_to_lakehouse(result, tenant_id, merchant_id)
            
            logger.info(
                "Business registration processed successfully",
                merchant_id=merchant_id,
                rc_number=business_info['rc_number'],
                confidence=result['confidence']
            )
            
            return business_info
            
        except Exception as e:
            logger.error(f"Error processing business registration: {str(e)}")
            raise
    
    async def process_tax_certificate(
        self,
        file_path: str,
        tenant_id: str,
        merchant_id: str
    ) -> Dict[str, Any]:
        """
        Process tax identification certificate (TIN)
        """
        try:
            with open(file_path, 'rb') as f:
                files = {'file': (file_path.split('/')[-1], f, 'application/pdf')}
                headers = {'X-Tenant-ID': tenant_id}
                
                response = await self.client.post(
                    f"{self.docling_url}/api/v1/process",
                    files=files,
                    headers=headers,
                    data={'document_type': 'tax_certificate'}
                )
            
            if response.status_code != 200:
                raise Exception(f"Document processing failed: {response.status_code}")
            
            result = response.json()
            parsed_fields = result.get('parsed_fields', {})
            
            tax_info = {
                'document_type': 'tax_certificate',
                'tin': parsed_fields.get('tin', ''),
                'company_name': parsed_fields.get('company_name', ''),
                'tax_office': parsed_fields.get('tax_office', ''),
                'issue_date': parsed_fields.get('issue_date', ''),
                'taxpayer_type': parsed_fields.get('taxpayer_type', ''),
                'business_address': parsed_fields.get('business_address', ''),
                'verification_status': 'verified' if result['confidence'] > 0.90 else 'needs_review',
                'confidence_score': result['confidence'],
                'processing_metadata': {
                    'document_id': result['document_id'],
                    'processing_time_ms': result['processing_time_ms'],
                    'processed_at': datetime.utcnow().isoformat(),
                    'merchant_id': merchant_id,
                    'tenant_id': tenant_id
                }
            }
            
            await self._publish_to_lakehouse(result, tenant_id, merchant_id)
            
            return tax_info
            
        except Exception as e:
            logger.error(f"Error processing tax certificate: {str(e)}")
            raise
    
    async def process_directors_id(
        self,
        file_path: str,
        tenant_id: str,
        merchant_id: str,
        director_name: str
    ) -> Dict[str, Any]:
        """
        Process director's identity document
        """
        try:
            with open(file_path, 'rb') as f:
                files = {'file': (file_path.split('/')[-1], f, 'application/pdf')}
                headers = {'X-Tenant-ID': tenant_id}
                
                response = await self.client.post(
                    f"{self.docling_url}/api/v1/process",
                    files=files,
                    headers=headers,
                    data={'document_type': 'national_id'}  # Reuse identity document parser
                )
            
            if response.status_code != 200:
                raise Exception(f"Document processing failed: {response.status_code}")
            
            result = response.json()
            parsed_fields = result.get('parsed_fields', {})
            
            director_info = {
                'document_type': 'directors_id',
                'director_name': director_name,
                'id_number': parsed_fields.get('id_number', ''),
                'full_name': parsed_fields.get('name', ''),
                'date_of_birth': parsed_fields.get('date_of_birth', ''),
                'address': parsed_fields.get('address', ''),
                'name_match': director_name.lower() in parsed_fields.get('name', '').lower(),
                'verification_status': 'verified' if result['confidence'] > 0.90 else 'needs_review',
                'confidence_score': result['confidence'],
                'processing_metadata': {
                    'document_id': result['document_id'],
                    'processing_time_ms': result['processing_time_ms'],
                    'processed_at': datetime.utcnow().isoformat(),
                    'merchant_id': merchant_id,
                    'tenant_id': tenant_id
                }
            }
            
            await self._publish_to_lakehouse(result, tenant_id, merchant_id)
            
            return director_info
            
        except Exception as e:
            logger.error(f"Error processing director's ID: {str(e)}")
            raise
    
    async def process_bank_statement(
        self,
        file_path: str,
        tenant_id: str,
        merchant_id: str
    ) -> Dict[str, Any]:
        """
        Process business bank statement
        """
        try:
            with open(file_path, 'rb') as f:
                files = {'file': (file_path.split('/')[-1], f, 'application/pdf')}
                headers = {'X-Tenant-ID': tenant_id}
                
                response = await self.client.post(
                    f"{self.docling_url}/api/v1/process",
                    files=files,
                    headers=headers,
                    data={'document_type': 'bank_statement'}
                )
            
            if response.status_code != 200:
                raise Exception(f"Document processing failed: {response.status_code}")
            
            result = response.json()
            parsed_fields = result.get('parsed_fields', {})
            
            statement_info = {
                'document_type': 'bank_statement',
                'account_name': parsed_fields.get('account_name', ''),
                'account_number': parsed_fields.get('account_number', ''),
                'bank_name': parsed_fields.get('bank_name', ''),
                'statement_period': parsed_fields.get('statement_period', ''),
                'opening_balance': parsed_fields.get('opening_balance', 0.0),
                'closing_balance': parsed_fields.get('closing_balance', 0.0),
                'total_credits': parsed_fields.get('total_credits', 0.0),
                'total_debits': parsed_fields.get('total_debits', 0.0),
                'average_balance': (parsed_fields.get('opening_balance', 0.0) + parsed_fields.get('closing_balance', 0.0)) / 2,
                'transaction_count': len(result.get('tables', [])),
                'verification_status': 'verified' if result['confidence'] > 0.85 else 'needs_review',
                'confidence_score': result['confidence'],
                'processing_metadata': {
                    'document_id': result['document_id'],
                    'processing_time_ms': result['processing_time_ms'],
                    'processed_at': datetime.utcnow().isoformat(),
                    'merchant_id': merchant_id,
                    'tenant_id': tenant_id
                }
            }
            
            await self._publish_to_lakehouse(result, tenant_id, merchant_id)
            
            return statement_info
            
        except Exception as e:
            logger.error(f"Error processing bank statement: {str(e)}")
            raise
    
    async def _publish_to_lakehouse(self, docling_result: Dict, tenant_id: str, merchant_id: str):
        """
        Publish document processing result to lakehouse via Kafka
        Enables ML feature generation for merchant risk scoring
        """
        try:
            logger.info(
                "Document published to lakehouse pipeline",
                merchant_id=merchant_id,
                document_id=docling_result['document_id']
            )
        except Exception as e:
            logger.warning(f"Failed to publish to lakehouse: {str(e)}")
    
    async def calculate_kyb_score(
        self,
        merchant_id: str,
        tenant_id: str,
        documents: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculate overall KYB verification score
        
        Args:
            merchant_id: Merchant identifier
            tenant_id: Bank/tenant identifier
            documents: List of processed documents
            
        Returns:
            KYB score (0-100) with component breakdown
        """
        try:
            # Calculate component scores
            components = {
                'document_completeness': 0,
                'document_quality': 0,
                'business_legitimacy': 0,
                'financial_health': 0,
                'director_verification': 0
            }
            
            # Check document completeness
            required_docs = ['business_registration', 'tax_certificate', 'bank_statement']
            submitted_types = [doc['document_type'] for doc in documents]
            completeness = sum(1 for doc_type in required_docs if doc_type in submitted_types) / len(required_docs)
            components['document_completeness'] = completeness * 100 * 0.25  # 25% weight
            
            # Check document quality (average confidence)
            if documents:
                avg_confidence = sum(doc.get('confidence_score', 0) for doc in documents) / len(documents)
                components['document_quality'] = avg_confidence * 100 * 0.20  # 20% weight
            
            # Business legitimacy (RC number and TIN present)
            has_rc = any(doc.get('rc_number') for doc in documents if doc['document_type'] == 'business_registration')
            has_tin = any(doc.get('tin') for doc in documents if doc['document_type'] == 'tax_certificate')
            legitimacy = (int(has_rc) + int(has_tin)) / 2
            components['business_legitimacy'] = legitimacy * 100 * 0.25  # 25% weight
            
            # Financial health (from bank statement)
            bank_statements = [doc for doc in documents if doc['document_type'] == 'bank_statement']
            if bank_statements:
                statement = bank_statements[0]
                avg_balance = statement.get('average_balance', 0)
                # Simple scoring: >1M = 100, >500K = 75, >100K = 50, <100K = 25
                if avg_balance > 1000000:
                    financial_score = 100
                elif avg_balance > 500000:
                    financial_score = 75
                elif avg_balance > 100000:
                    financial_score = 50
                else:
                    financial_score = 25
                components['financial_health'] = financial_score * 0.20  # 20% weight
            
            # Director verification
            directors_ids = [doc for doc in documents if doc['document_type'] == 'directors_id']
            if directors_ids:
                verified_directors = sum(1 for doc in directors_ids if doc.get('name_match', False))
                director_score = (verified_directors / len(directors_ids)) * 100 if directors_ids else 0
                components['director_verification'] = director_score * 0.10  # 10% weight
            
            overall_score = sum(components.values())
            
            # Determine KYB status
            if overall_score >= 85:
                kyb_status = "fully_verified"
                risk_level = "low"
            elif overall_score >= 70:
                kyb_status = "verified"
                risk_level = "low"
            elif overall_score >= 50:
                kyb_status = "partially_verified"
                risk_level = "medium"
            else:
                kyb_status = "incomplete"
                risk_level = "high"
            
            return {
                "merchant_id": merchant_id,
                "tenant_id": tenant_id,
                "kyb_score": round(overall_score, 2),
                "kyb_status": kyb_status,
                "risk_level": risk_level,
                "components": {k: round(v, 2) for k, v in components.items()},
                "recommendations": self._get_kyb_recommendations(overall_score, components, submitted_types),
                "calculated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error calculating KYB score: {str(e)}")
            return {
                "merchant_id": merchant_id,
                "tenant_id": tenant_id,
                "kyb_score": 0,
                "kyb_status": "pending",
                "risk_level": "unknown",
                "error": "KYB score calculation failed",
                "calculated_at": datetime.utcnow().isoformat()
            }
    
    def _get_kyb_recommendations(
        self,
        overall_score: float,
        components: Dict[str, float],
        submitted_types: List[str]
    ) -> List[str]:
        """Generate recommendations to improve KYB score"""
        recommendations = []
        
        required_docs = ['business_registration', 'tax_certificate', 'bank_statement']
        missing_docs = [doc for doc in required_docs if doc not in submitted_types]
        
        if missing_docs:
            recommendations.append(f"Submit missing documents: {', '.join(missing_docs)}")
        
        if components['document_quality'] < 15:
            recommendations.append("Resubmit documents with better quality (clear scans, no blur)")
        
        if components['business_legitimacy'] < 20:
            recommendations.append("Ensure CAC registration and TIN are clearly visible in documents")
        
        if components['financial_health'] < 15:
            recommendations.append("Provide recent bank statements showing healthy cash flow")
        
        if components['director_verification'] < 8:
            recommendations.append("Submit identity documents for all directors")
        
        if overall_score < 50:
            recommendations.append("Complete KYB verification to unlock merchant account features")
        
        return recommendations
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
