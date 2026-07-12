# Business Service

A comprehensive Business Service for the 54link Core Banking Platform, providing centralized management of business entities, verification, compliance, and associated resources.

## Features

- **Business Management**: Create, retrieve, update, and manage business entities
- **Verification Workflow**: Multi-step verification process for business validation
- **Compliance Tracking**: Track compliance status and maintain audit logs
- **User Management**: Manage users associated with businesses and their roles
- **Account Management**: Associate bank accounts with businesses
- **Profile Management**: Extended business profile information
- **Audit Logging**: Complete audit trail for compliance

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 16+
- Docker & Docker Compose (for local development)
- Kubernetes 1.24+ (for production deployment)

### Local Development

1. **Clone and setup**:
```bash
cd services/business-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start dependencies with Docker Compose**:
```bash
docker-compose up -d
```

4. **Initialize database**:
```bash
python -c "from database import init_db; init_db()"
```

5. **Run the service**:
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8086 --reload
```

6. **Access the service**:
- API: http://localhost:8086
- Health check: http://localhost:8086/health
- Interactive docs: http://localhost:8086/docs

### Running Tests

```bash
# Run all tests
make test

# Run specific test file
pytest tests/test_business.py -v

# Run with coverage
pytest tests/ --cov=. --cov-report=html
```

## API Documentation

### Base URL
```
http://localhost:8086/api/v1
```

### Required Headers
All endpoints (except `/health` and `/ready`) require:
```
x-tenant-id: <tenant-id>
x-keycloak-id: <user-id>
x-keycloak-realm: 54link-dev
```

### Core Endpoints

#### Business Management

**Create Business**
```http
POST /business
Content-Type: application/json
x-tenant-id: tenant-1
x-keycloak-id: user-1
x-keycloak-realm: 54link-dev

{
  "name": "Acme Corp",
  "registration_number": "RC123456",
  "business_type": "limited_company",
  "industry_code": "6201",
  "email_address": "info@acme.com"
}
```

**Get Business**
```http
GET /business/{business_id}
x-tenant-id: tenant-1
x-keycloak-id: user-1
x-keycloak-realm: 54link-dev
```

**List Businesses**
```http
GET /business/all?skip=0&limit=50&status=verified
x-tenant-id: tenant-1
x-keycloak-id: user-1
x-keycloak-realm: 54link-dev
```

**Update Business**
```http
PUT /business/{business_id}
Content-Type: application/json

{
  "name": "Updated Name",
  "industry_code": "6202"
}
```

#### Verification Workflow

**Initiate Verification**
```http
POST /business/{business_id}/verify
Content-Type: application/json

{
  "reason": "Initial verification"
}
```

**Approve Verification**
```http
POST /business/{business_id}/approve-verification
Content-Type: application/json

{
  "approved_by": "admin-user-id",
  "reason": "Documentation approved"
}
```

**Reject Verification**
```http
POST /business/{business_id}/reject-verification
Content-Type: application/json

{
  "reason": "Invalid documentation"
}
```

#### Business Users

**Add User to Business**
```http
POST /business/{business_id}/users
Content-Type: application/json

{
  "keycloak_id": "user-123",
  "role": "admin",
  "permissions": { }
}
```

**List Business Users**
```http
GET /business/{business_id}/users?skip=0&limit=50
```

**Update User Role**
```http
PUT /business/{business_id}/users/{user_id}
Content-Type: application/json

{
  "role": "staff",
  "permissions": { }
}
```

#### Business Accounts

**Associate Account**
```http
POST /business/{business_id}/accounts
Content-Type: application/json

{
  "account_id": "acc-123",
  "account_purpose": "primary_operations",
  "is_primary": true
}
```

**List Accounts**
```http
GET /business/{business_id}/accounts?skip=0&limit=50
```

**Disassociate Account**
```http
DELETE /business/{business_id}/accounts/{account_id}
```

## Building & Deployment

### Build and Test

```bash
make build
```

This will:
1. Install dependencies
2. Run all tests
3. Generate coverage reports

### Docker

**Build Image**
```bash
make docker-build
```

**Run Locally**
```bash
make docker-run
```

**Stop Services**
```bash
make docker-down
```

### Kubernetes

**Prerequisites**
- Kubernetes cluster running
- kubectl configured
- Helm 3+ installed
- Docker registry configured

**Deploy with kubectl**
```bash
# Create namespace
kubectl create namespace banking-platform

# Apply manifests
kubectl apply -f infrastructure/kubernetes/
```

**Deploy with Helm**
```bash
helm install business-service ./charts/business-service \
  -n banking-platform \
  --set image.tag=0.0.1 \
  --set secrets.DATABASE_URI="postgresql://..." \
  --set secrets.KEYCLOAK_URL="https://..." \
  --set secrets.KEYCLOAK_CLIENT_SECRET="your-secret"
```

**Check Deployment**
```bash
# Check pod status
kubectl get pods -n banking-platform -l app=business-service

# View logs
kubectl logs -n banking-platform -l app=business-service -f

# Port forward for testing
kubectl port-forward -n banking-platform svc/business-service 8086:80
```

### CI/CD Pipeline

See `.github/workflows/` for GitHub Actions CI/CD configuration. The pipeline:
1. Runs tests on every push
2. Builds Docker image on PR merge
3. Pushes image to registry
4. Deploys to Kubernetes on release

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| ENVIRONMENT | Deployment environment | development |
| DEBUG | Enable debug mode | true |
| DATABASE_URI | PostgreSQL connection string | localhost:5432 |
| DATABASE_POOL_SIZE | Connection pool size | 10 |
| KAFKA_BROKERS | Kafka brokers | localhost:9092 |
| KEYCLOAK_URL | Keycloak URL | http://localhost:8080 |
| PERMIFY_HOST | Permify host | localhost |
| PERMIFY_PORT | Permify port | 3476 |
| PORT | Service port | 8086 |

### Database

PostgreSQL 16+ with the following schemas:
- `public.businesses` - Business entities
- `public.business_profiles` - Extended profiles
- `public.business_users` - User associations
- `public.business_accounts` - Account associations
- `public.business_audit_logs` - Audit trail

## Architecture

### Technology Stack
- **Framework**: FastAPI (async Python)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: Keycloak + Permify
- **Messaging**: Kafka for event publishing
- **Deployment**: Docker + Kubernetes
- **Orchestration**: Dapr (optional)

### Request/Response Flow
```
Client Request
    ↓
RequiredHeadersMiddleware (validate headers)
    ↓
AuditMiddleware (log request)
    ↓
Route Handler
    ↓
Service Layer (business logic)
    ↓
Repository Layer (database access)
    ↓
Database
    ↓
Event Publishing (Kafka)
    ↓
Response
```

### Error Handling

All errors follow a standardized format:
```json
{
  "message": "Error description",
  "code": "BUSINESS-SVC-CODE",
  "status_code": 400,
  "details": { }
}
```

Error Codes:
- `BUSINESS-SVC-VAL-*` - Validation errors (400)
- `BUSINESS-SVC-AUTH-*` - Authentication/Authorization errors (401/403)
- `BUSINESS-SVC-NOT-*` - Not found errors (404)
- `BUSINESS-SVC-CONF-*` - Conflict errors (409)
- `BUSINESS-SVC-INT-*` - Internal errors (500)

## Health Checks

### Liveness Probe
```http
GET /health
```
Returns: `{"status": "healthy", "service": "business-service", "version": "1.0.0"}`

### Readiness Probe
```http
GET /ready
```
Returns: `{"status": "ready", "service": "business-service"}`

## Monitoring & Logging

- **Logs**: Structured JSON logging to stdout
- **Metrics**: Prometheus metrics available at `/metrics`
- **Tracing**: OpenTelemetry integration (optional)

## Support

For issues or questions, contact the development team at dev@54link.com
