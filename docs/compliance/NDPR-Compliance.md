# NDPR (Nigeria Data Protection Regulation) Compliance — 54Bank

## Overview
The Nigeria Data Protection Regulation (NDPR) 2019 and the Nigeria Data Protection Act (NDPA) 2023 govern the processing of personal data of Nigerian residents. 54Bank processes Personally Identifiable Information (PII) including BVN, NIN, phone numbers, email addresses, and financial records.

## Data Classification

| Category | Examples | Protection Level |
|----------|----------|-----------------|
| **Sensitive PII** | BVN, NIN, biometric data | Encrypted at rest + in transit, masked in logs, Vault-managed access |
| **Financial Data** | Account balances, transactions | Encrypted, audit-logged, 7-year retention |
| **Contact Data** | Phone, email, address | Encrypted at rest, consent-tracked |
| **Behavioral Data** | Login times, device fingerprints | Pseudonymized, 2-year retention |

## NDPR Article Compliance

### Article 2.1: Lawful Processing
- **Implementation**: All data processing has documented legal basis (contract performance for banking services, legal obligation for CBN reporting, consent for marketing)
- **Evidence**: Service-level data processing agreements; consent management in Keycloak

### Article 2.2: Data Minimization
- **Implementation**: Services collect only required fields (see schema: `data JSONB` stores only business-relevant attributes)
- **Evidence**: 512 service schemas enforce minimal required fields

### Article 2.3: Purpose Limitation
- **Implementation**: Data used only for stated banking purposes
- **Evidence**: Service-level access controls via Vault policies; each service can only access its own data path

### Article 2.5: Data Residency
- **Implementation**: All data stored in Nigeria or approved jurisdictions
- **Infrastructure**:
  - **On-Premise**: Lagos + Abuja data centers (Nigerian soil)
  - **AWS**: af-south-1 (Cape Town) primary — data does not leave Africa
  - **OpenStack**: Nigerian data center operator
  - **DR**: me-south-1 (Bahrain) — acceptable under CBN guidelines for DR
- **Evidence**: Terraform configs enforce region constraints; no cross-continental replication

### Article 2.6: Data Retention
| Data Type | Retention | Deletion Method |
|-----------|-----------|-----------------|
| Transaction records | 7 years | S3 lifecycle → Glacier → delete |
| KYC documents | 7 years post account closure | Automated purge job |
| Audit logs | 7 years | Immutable storage, auto-archive |
| Session data | 24 hours | Redis TTL auto-expiry |
| Idempotency keys | 24 hours | PostgreSQL TTL-based cleanup |
| Marketing consent | Until withdrawal | Soft-delete with timestamp |

### Article 2.7: Data Subject Rights

| Right | Implementation | Endpoint |
|-------|----------------|----------|
| **Right of Access** | Customer can view all stored data | `GET /v1/customer/{id}/data-export` |
| **Right to Rectification** | Customer can update personal details | `PUT /v1/customer/{id}/profile` |
| **Right to Erasure** | Soft-delete with anonymization (except legal holds) | `DELETE /v1/customer/{id}` |
| **Right to Portability** | JSON/CSV export of all customer data | `GET /v1/customer/{id}/data-export?format=csv` |
| **Right to Object** | Marketing opt-out | `PUT /v1/customer/{id}/consent` |

### Article 2.8: Security Measures
- **Encryption at rest**: KMS (AWS), Barbican (OpenStack), LUKS (on-prem) for all data stores
- **Encryption in transit**: TLS 1.2+ enforced (HSTS headers on all 510 services)
- **Access control**: RBAC (Keycloak) + ReBAC (Permify) + service mesh mTLS
- **PII masking**: `mask_pii()` function in all 510 services masks BVN, NIN, phone, email in logs
- **Input validation**: `sanitize_input()` / `validate_request()` in all services
- **Audit logging**: Every data access logged with actor, IP, user agent, timestamp

### Article 2.10: Breach Notification
- **Detection**: Prometheus alerting + PagerDuty escalation
- **Internal notification**: Within 1 hour of detection
- **NITDA notification**: Within 72 hours (as required by NDPR)
- **Data subject notification**: Without undue delay if high risk
- **Procedure**: Documented in DR runbook (`k8s/dr/disaster-recovery.yaml`)

### Article 2.12: Data Protection Impact Assessment (DPIA)
- **Conducted for**: Account opening, KYC verification, cross-border transfers, biometric processing
- **Reviewed**: Annually or when introducing new data processing activities
- **Stored**: `/docs/compliance/DPIA/` (separate repository, access-controlled)

## Technical Controls Summary

| Control | Coverage | Evidence |
|---------|----------|----------|
| PII masking in logs | 510/510 services | `mask_pii()` function |
| Encryption at rest | 100% data stores | KMS/Barbican/LUKS configs |
| Encryption in transit | 510/510 services | HSTS + TLS enforcement |
| Access audit logging | 510/510 services | Audit trail middleware |
| Data residency | 100% Nigerian soil | Terraform region constraints |
| Retention enforcement | Automated | S3 lifecycle + DB cleanup jobs |
| Consent management | Keycloak integration | Consent attributes per user |
| DSAR (Data Subject Access Request) | API endpoints ready | Customer portal integration |

## Compliance Officer Contact
- **Data Protection Officer**: [DPO Name]
- **NITDA Registration**: [Registration Number]
- **Annual Audit**: Q1 each year
