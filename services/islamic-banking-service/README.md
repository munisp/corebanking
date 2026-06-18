# Islamic Banking Service

Shariah-compliant financial products and services for the 54link banking platform.

## Overview

This service provides comprehensive Islamic banking capabilities including:

- **Murabaha**: Cost-plus financing for asset purchases
- **Musharaka**: Partnership-based financing
- **Ijara**: Islamic leasing arrangements
- **Takaful**: Islamic insurance products
- **Sukuk**: Islamic bonds and investments

## Features

- Full CRUD operations for all Islamic banking products
- Automatic calculations (profit margins, installments, rental amounts)
- Reference number generation
- Event publishing to data lakehouse
- Prometheus metrics
- Multi-tenancy support
- RESTful API endpoints

## API Endpoints

Base URL: `/api/v1`

### Murabaha

- `GET /murabaha` - Get all Murabaha products
- `GET /murabaha/:id` - Get specific Murabaha product
- `POST /murabaha` - Apply for Murabaha financing
- `DELETE /murabaha/:id` - Cancel Murabaha application
- `PATCH /murabaha/:id/status` - Update Murabaha status

### Musharaka

- `GET /musharaka` - Get all Musharaka products
- `GET /musharaka/:id` - Get specific Musharaka product
- `POST /musharaka` - Apply for Musharaka partnership
- `DELETE /musharaka/:id` - Cancel Musharaka application
- `PATCH /musharaka/:id/status` - Update Musharaka status

### Ijara

- `GET /ijara` - Get all Ijara products
- `GET /ijara/:id` - Get specific Ijara product
- `POST /ijara` - Apply for Ijara lease
- `DELETE /ijara/:id` - Cancel Ijara application
- `PATCH /ijara/:id/status` - Update Ijara status

### Takaful

- `GET /takaful` - Get all Takaful products
- `GET /takaful/:id` - Get specific Takaful product
- `POST /takaful` - Apply for Takaful policy
- `DELETE /takaful/:id` - Cancel Takaful application
- `PATCH /takaful/:id/status` - Update Takaful status

### Sukuk

- `GET /sukuk` - Get all Sukuk investments
- `GET /sukuk/:id` - Get specific Sukuk investment
- `POST /sukuk` - Invest in Sukuk
- `DELETE /sukuk/:id` - Cancel Sukuk investment
- `PATCH /sukuk/:id/status` - Update Sukuk status

### Common

- `GET /products` - Get all Islamic banking products (aggregated)
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

## Environment Variables

```bash
PORT=8029
DATABASE_URL=postgresql://user:password@host:5432/dbname
LAKEHOUSE_URL=http://lakehouse-service:8080
```

## Running Locally

```bash
# Install dependencies
go mod download

# Run the service
go run .
```

## Running with Docker

```bash
# Build image
docker build -t islamic-banking-service .

# Run container
docker run -p 8029:8029 \
  -e DATABASE_URL=postgresql://... \
  -e LAKEHOUSE_URL=http://... \
  islamic-banking-service
```

## Request Examples

### Apply for Murabaha

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

### Apply for Musharaka

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

### Apply for Ijara

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

## Database Schema

The service uses PostgreSQL with tables for each product type:

- `murabaha_products`
- `musharaka_products`
- `ijara_products`
- `takaful_products`
- `sukuk_products`

All tables include tenant isolation and user scoping.

## Shariah Compliance

All products are designed to comply with Islamic financial principles:

- No interest (riba)
- Asset-backed financing
- Risk sharing in partnerships
- Transparent pricing
- Ethical investments

## Monitoring

Prometheus metrics available at `/metrics`:

- Application counters by product type and status
- Active product gauges
- Request latency histograms

## Error Codes

- `ISB-ISB-BAD-4001` - Bad request
- `ISB-ISB-NOT-4040` - Not found
- `ISB-ISB-INT-5000` - Internal error
- `ISB-ISB-VAL-4002` - Validation failed
- `ISB-ISB-DEC-4003` - Decode error
- `ISB-ISB-UNA-4010` - Unauthorized
- `ISB-ISB-FOR-4030` - Forbidden

## License

Copyright © 2026 54link
