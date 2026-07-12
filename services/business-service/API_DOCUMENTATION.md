"""API Documentation for Business Service."""

# Business Service API Reference

## Overview

The Business Service provides a comprehensive API for managing business entities in the 54link Core Banking Platform. All endpoints are versioned under `/api/v1/` and require authentication headers.

## Authentication

All API requests (except `/health` and `/ready`) require the following headers:

```
x-tenant-id: <tenant-identifier>
x-keycloak-id: <keycloak-user-id>
x-keycloak-realm: 54link-dev
```

## Response Format

All successful responses follow this format:

```json
{
  "message": "success",
  "data": { /* response data */ },
  "code": "BUSINESS-SVC-OK-200"
}
```

Error responses:

```json
{
  "message": "Error description",
  "code": "BUSINESS-SVC-ERR-CODE",
  "status_code": 400,
  "details": { /* error details */ }
}
```

## Endpoints

### Health & System

#### Health Check
- **GET** `/health`
- **Response**: `{"status": "healthy", "service": "business-service", "version": "1.0.0"}`
- **Auth**: Not required

#### Readiness Check
- **GET** `/ready`
- **Response**: `{"status": "ready", "service": "business-service"}`
- **Auth**: Not required

#### System Info
- **GET** `/api/v1/system/info`
- **Response**: Service information and version

### Business Management

#### Create Business
- **POST** `/api/v1/business`
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "name": "string (required, 1-255 chars)",
    "registration_number": "string (required, unique)",
    "business_type": "limited_company|sole_proprietor|partnership|ngo|government|other",
    "industry_code": "string (optional)",
    "headquarters_address": "string (optional)",
    "headquarters_location": "string (optional)",
    "website_url": "string (optional, URL format)",
    "phone_number": "string (optional)",
    "email_address": "string (optional, email format)",
    "registration_date": "ISO8601 datetime (optional)",
    "metadata": "object (optional)",
    "settings": "object (optional)"
  }
  ```
- **Response** (201):
  ```json
  {
    "id": "uuid",
    "tenant_id": "string",
    "name": "string",
    "registration_number": "string",
    "business_type": "string",
    "verification_status": "unverified|pending_verification|verified|rejected|suspended",
    "compliance_status": "compliant|non_compliant|pending_review|suspended",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
  ```

#### Get Business
- **GET** `/api/v1/business/{business_id}`
- **Auth**: Required
- **Parameters**: 
  - `business_id` (path, required): Business ID
- **Response** (200): Business object (same as Create)

#### List Businesses
- **GET** `/api/v1/business/all`
- **Auth**: Required
- **Query Parameters**:
  - `skip` (integer, optional, default=0): Skip this many records
  - `limit` (integer, optional, default=50): Max 50
  - `status` (string, optional): Filter by verification status
- **Response** (200):
  ```json
  {
    "total": 100,
    "skip": 0,
    "limit": 50,
    "businesses": [ /* list of businesses */ ]
  }
  ```

#### Update Business
- **PUT** `/api/v1/business/{business_id}`
- **Auth**: Required
- **Request Body**: Any business fields to update (all optional)
- **Response** (200): Updated business object

#### Delete Business
- **DELETE** `/api/v1/business/{business_id}`
- **Auth**: Required
- **Response** (200): Deleted business object (soft delete)

### Business Verification

#### Initiate Verification
- **POST** `/api/v1/business/{business_id}/verify`
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "reason": "string (optional)"
  }
  ```
- **Response** (200): Business object with `verification_status: pending_verification`

#### Approve Verification
- **POST** `/api/v1/business/{business_id}/approve-verification`
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "approved_by": "string (required, admin user ID)",
    "reason": "string (optional)"
  }
  ```
- **Response** (200): Business object with `verification_status: verified`

#### Reject Verification
- **POST** `/api/v1/business/{business_id}/reject-verification`
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "reason": "string (required)"
  }
  ```
- **Response** (200): Business object with `verification_status: rejected`

### Business Lifecycle

#### Suspend Business
- **POST** `/api/v1/business/{business_id}/suspend`
- **Auth**: Required
- **Query Parameters**:
  - `reason` (string, required): Suspension reason
- **Response** (200): Business object with suspended status

#### Activate Business
- **POST** `/api/v1/business/{business_id}/activate`
- **Auth**: Required
- **Response** (200): Business object with verified status

### Business Settings

#### Update Settings
- **PUT** `/api/v1/business/{business_id}/settings`
- **Auth**: Required
- **Request Body**: Settings object (merged with existing)
- **Response** (200): Business object with updated settings

#### Update Metadata
- **PUT** `/api/v1/business/{business_id}/metadata`
- **Auth**: Required
- **Request Body**: Metadata object (merged with existing)
- **Response** (200): Business object with updated metadata

### Business Users

#### Add User to Business
- **POST** `/api/v1/business/{business_id}/users`
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "keycloak_id": "string (required)",
    "role": "owner|admin|staff|auditor (required)",
    "permissions": "object (optional)"
  }
  ```
- **Response** (201):
  ```json
  {
    "id": "uuid",
    "business_id": "uuid",
    "keycloak_id": "string",
    "role": "string",
    "permissions": "object",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
  ```

#### List Business Users
- **GET** `/api/v1/business/{business_id}/users`
- **Auth**: Required
- **Query Parameters**:
  - `skip` (integer, optional, default=0)
  - `limit` (integer, optional, default=50)
- **Response** (200):
  ```json
  {
    "business_id": "uuid",
    "total": 10,
    "users": [ /* list of users */ ]
  }
  ```

#### Update User Role
- **PUT** `/api/v1/business/{business_id}/users/{user_id}`
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "role": "string (required)",
    "permissions": "object (optional)"
  }
  ```
- **Response** (200): Updated business user object

#### Remove User from Business
- **DELETE** `/api/v1/business/{business_id}/users/{user_id}`
- **Auth**: Required
- **Response** (200): Removed user object

### Business Accounts

#### Associate Account
- **POST** `/api/v1/business/{business_id}/accounts`
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "account_id": "string (required)",
    "account_purpose": "string (optional)",
    "is_primary": "boolean (optional, default=false)"
  }
  ```
- **Response** (201):
  ```json
  {
    "id": "uuid",
    "business_id": "uuid",
    "account_id": "string",
    "account_purpose": "string",
    "is_primary": "boolean",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
  ```

#### List Business Accounts
- **GET** `/api/v1/business/{business_id}/accounts`
- **Auth**: Required
- **Query Parameters**:
  - `skip` (integer, optional, default=0)
  - `limit` (integer, optional, default=50)
- **Response** (200):
  ```json
  {
    "business_id": "uuid",
    "total": 5,
    "accounts": [ /* list of accounts */ ]
  }
  ```

#### Disassociate Account
- **DELETE** `/api/v1/business/{business_id}/accounts/{account_id}`
- **Auth**: Required
- **Response** (200): Disassociated account object

#### Set Primary Account
- **POST** `/api/v1/business/{business_id}/accounts/{account_id}/primary`
- **Auth**: Required
- **Response** (200):
  ```json
  {
    "message": "Account set as primary",
    "account_id": "string"
  }
  ```

## Error Codes

### Validation Errors (400)
- `BUSINESS-SVC-VAL-4001`: Validation error

### Authentication/Authorization (401/403)
- `BUSINESS-SVC-AUTH-4001`: Unauthorized
- `BUSINESS-SVC-AUTH-4003`: Permission denied

### Not Found (404)
- `BUSINESS-SVC-NOT-4004`: Business not found
- `BUSINESS-SVC-NOT-4005`: Resource not found

### Conflict (409)
- `BUSINESS-SVC-CONF-4009`: Business already exists

### Server Errors (500)
- `BUSINESS-SVC-INT-5000`: Internal server error
- `BUSINESS-SVC-EXT-5001`: External service error

## Status Codes Summary

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 202 | Accepted - Request accepted (idempotent) |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Missing/invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

## Rate Limiting

Currently, rate limiting is not enforced. Future versions may implement:
- 1000 requests per minute per tenant
- 100 requests per minute per user

## Pagination

List endpoints support cursor-based pagination:
- `skip`: Number of records to skip (default: 0)
- `limit`: Number of records to return (default: 50, max: 100)

## Filtering

List endpoints support filtering by status:
- `status`: Filter by `verification_status` (verified, pending_verification, etc.)

## Sorting

Default sorting is by `created_at` descending. Future versions may support custom sorting.

## Webhooks

Webhook support for business events (creation, verification, suspension) is planned for future releases.

## SDK & Client Libraries

SDKs are available for:
- Python: `pip install 54link-business-sdk`
- JavaScript/TypeScript: `npm install @54link/business-sdk`
- Go: `go get github.com/54link/business-sdk-go`

## Examples

### Create a Business

```bash
curl -X POST http://localhost:8086/api/v1/business \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant-1" \
  -H "x-keycloak-id: user-1" \
  -H "x-keycloak-realm: 54link-dev" \
  -d '{
    "name": "Acme Corporation",
    "registration_number": "RC123456",
    "business_type": "limited_company",
    "industry_code": "6201",
    "email_address": "info@acme.com"
  }'
```

### Get a Business

```bash
curl http://localhost:8086/api/v1/business/550e8400-e29b-41d4-a716-446655440000 \
  -H "x-tenant-id: tenant-1" \
  -H "x-keycloak-id: user-1" \
  -H "x-keycloak-realm: 54link-dev"
```

### List Businesses

```bash
curl "http://localhost:8086/api/v1/business/all?skip=0&limit=20&status=verified" \
  -H "x-tenant-id: tenant-1" \
  -H "x-keycloak-id: user-1" \
  -H "x-keycloak-realm: 54link-dev"
```

### Initiate Verification

```bash
curl -X POST http://localhost:8086/api/v1/business/550e8400-e29b-41d4-a716-446655440000/verify \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant-1" \
  -H "x-keycloak-id: user-1" \
  -H "x-keycloak-realm: 54link-dev" \
  -d '{"reason": "Initial verification"}'
```

## Support

For API support, contact dev@54link.com or refer to the main README.md
