# Islamic Banking Service - Quick Testing Guide

## Quick Start

```bash
# Navigate to service directory
cd 54link_core_banking/services/islamic-banking-service

# Install dependencies
go mod download
go mod tidy

# Copy environment file
cp .env.example .env

# Run service
go run .
```

## Test Endpoints

### 1. Health Check

```bash
curl http://localhost:8029/health
```

### 2. Test Murabaha (Cost-Plus Financing)

**Create Application:**

```bash
curl -X POST http://localhost:8029/api/v1/murabaha \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant123" \
  -H "x-keycloak-id: user456" \
  -d '{
    "asset_name": "Toyota Camry 2024",
    "cost_price": 15000000,
    "profit_margin": 10.0,
    "tenure_months": 24
  }'
```

**Get All Murabaha:**

```bash
curl -H "X-Tenant-ID: tenant123" -H "x-keycloak-id: user456" \
  http://localhost:8029/api/v1/murabaha
```

### 3. Test Musharaka (Partnership)

```bash
curl -X POST http://localhost:8029/api/v1/musharaka \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant123" \
  -H "x-keycloak-id: user456" \
  -d '{
    "business_name": "Tech Solutions Ltd",
    "customer_contribution": 3000000,
    "bank_contribution": 5000000,
    "customer_profit_share": 40.0
  }'
```

### 4. Test Ijara (Leasing)

```bash
curl -X POST http://localhost:8029/api/v1/ijara \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant123" \
  -H "x-keycloak-id: user456" \
  -d '{
    "asset_name": "Office Equipment",
    "asset_value": 2000000,
    "tenure_months": 18,
    "lease_type": "operating"
  }'
```

### 5. Test Takaful (Insurance)

```bash
curl -X POST http://localhost:8029/api/v1/takaful \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant123" \
  -H "x-keycloak-id: user456" \
  -d '{
    "policy_type": "family",
    "policy_name": "Family Protection Plan",
    "coverage_amount": 5000000,
    "frequency": "monthly"
  }'
```

### 6. Test Sukuk (Bonds)

```bash
curl -X POST http://localhost:8029/api/v1/sukuk \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant123" \
  -H "x-keycloak-id: user456" \
  -d '{
    "sukuk_type": "ijara",
    "sukuk_name": "Real Estate Sukuk 2026",
    "investment_amount": 10000000,
    "tenure_months": 36
  }'
```

### 7. Get All Products (Aggregated)

```bash
curl -H "X-Tenant-ID: tenant123" -H "x-keycloak-id: user456" \
  http://localhost:8029/api/v1/products
```

### 8. Update Status

```bash
curl -X PATCH http://localhost:8029/api/v1/murabaha/{product_id}/status \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant123" \
  -H "x-keycloak-id: user456" \
  -d '{
    "status": "approved"
  }'
```

### 9. Cancel Product

```bash
curl -X DELETE http://localhost:8029/api/v1/murabaha/{product_id} \
  -H "X-Tenant-ID: tenant123" \
  -H "x-keycloak-id: user456"
```

## Expected Responses

### Success Response

```json
{
  "success": true,
  "message": "Murabaha application submitted successfully",
  "data": {
    "id": "murabaha_abc12345",
    "tenant_id": "tenant123",
    "user_id": "user456",
    "asset_name": "Toyota Camry 2024",
    "cost_price": 15000000,
    "selling_price": 16500000,
    "profit_margin": 10,
    "tenure_months": 24,
    "monthly_installment": 687500,
    "status": "pending",
    "reference_number": "MUR-2026-001234",
    "application_date": "2026-01-27T10:30:00Z",
    "created_at": "2026-01-27T10:30:00Z"
  }
}
```

### Error Response

```json
{
  "detail": {
    "message": "Validation failed",
    "status": "error",
    "code": "ISB-ISB-VAL-4002",
    "service": "islamic-banking-service",
    "details": null
  }
}
```

## Metrics

```bash
# View Prometheus metrics
curl http://localhost:8029/metrics
```

## Docker Testing

```bash
# Build
docker build -t islamic-banking-service .

# Run
docker run -p 8029:8029 \
  -e DATABASE_URL=postgresql://postgres:password@host.docker.internal:5432/islamic_banking_db \
  -e LAKEHOUSE_URL=http://lakehouse-service:8080 \
  islamic-banking-service

# Test
curl http://localhost:8029/health
```

## Database Check

```bash
# Connect to PostgreSQL
psql -U postgres -d islamic_banking_db

# Check tables
\dt

# View data
SELECT * FROM murabaha_products;
SELECT * FROM musharaka_products;
SELECT * FROM ijara_products;
SELECT * FROM takaful_products;
SELECT * FROM sukuk_products;
```

## Troubleshooting

### Service won't start

- Check DATABASE_URL is correct
- Ensure PostgreSQL is running
- Check port 8029 is available

### Database errors

- Ensure database exists: `createdb islamic_banking_db`
- Check connection string format
- Verify PostgreSQL credentials

### 404 Errors

- Ensure using correct base path: `/api/v1`
- Check HTTP method (GET, POST, PATCH, DELETE)
- Verify endpoint spelling

### Validation Errors

- Check all required fields are present
- Verify data types (numbers, strings)
- Ensure positive values for amounts

## Product Status Flow

```
pending → approved → active → completed
         ↓
       rejected
         ↓
      cancelled
```

## Shariah Compliance Checks

✅ No interest (riba) - only profit margins  
✅ Asset-backed financing  
✅ Risk sharing (Musharaka)  
✅ Transparent pricing  
✅ Ethical investments

## Integration with Mobile App

The service is fully compatible with the Flutter mobile app at:

- `banks/client/mobile_app/lib/services/islamic_banking_service.dart`

All request/response formats match the mobile app's expectations.
