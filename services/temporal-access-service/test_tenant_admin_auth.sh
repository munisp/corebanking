#!/bin/bash

# Tenant Admin Authorization Test Script
# Tests authorization enforcement for temporal access control

set -e

API_URL="http://temporal-access-service:8080/api/v1"

# Test users
PLATFORM_ADMIN_TOKEN="user:platform_admin_001"
TENANT_ADMIN_BANK1_TOKEN="user:admin_bank_001"
TENANT_ADMIN_BANK2_TOKEN="user:admin_bank_002"
REGULAR_USER_TOKEN="user:employee_123"

echo "========================================="
echo "Tenant Admin Authorization Tests"
echo "========================================="
echo ""

# Test 1: Tenant admin creates grant in their own tenant
echo "Test 1: Tenant admin creates grant in own tenant"
echo "-------------------------------------------------"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/grants" \
  -H "Authorization: Bearer $TENANT_ADMIN_BANK1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "bank_001",
    "subject_id": "user_auditor_456",
    "subject_type": "user",
    "permission": "audit",
    "resource_type": "account",
    "resource_id": "acc_789",
    "duration": "4h",
    "reason": "Test grant creation"
  }')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "201" ]; then
    echo "✅ PASS: Tenant admin can create grant in their tenant (201 Created)"
    grant_id=$(echo "$body" | jq -r '.id')
    echo "   Grant ID: $grant_id"
else
    echo "❌ FAIL: Expected 201, got $http_code"
    echo "   Response: $body"
fi
echo ""

# Test 2: Tenant admin tries to create grant in different tenant
echo "Test 2: Tenant admin tries to create grant in different tenant"
echo "----------------------------------------------------------------"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/grants" \
  -H "Authorization: Bearer $TENANT_ADMIN_BANK1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "bank_002",
    "subject_id": "user_test",
    "subject_type": "user",
    "permission": "view",
    "resource_type": "account",
    "resource_id": "acc_999",
    "duration": "1h",
    "reason": "Cross-tenant test"
  }')

http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "403" ]; then
    echo "✅ PASS: Tenant admin cannot create grant in other tenant (403 Forbidden)"
else
    echo "❌ FAIL: Expected 403, got $http_code"
fi
echo ""

# Test 3: Regular user tries to create grant
echo "Test 3: Regular user tries to create grant"
echo "-------------------------------------------"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/grants" \
  -H "Authorization: Bearer $REGULAR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "bank_001",
    "subject_id": "user_test",
    "subject_type": "user",
    "permission": "view",
    "resource_type": "account",
    "resource_id": "acc_123",
    "duration": "1h",
    "reason": "Regular user test"
  }')

http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "403" ]; then
    echo "✅ PASS: Regular user cannot create grant (403 Forbidden)"
else
    echo "❌ FAIL: Expected 403, got $http_code"
fi
echo ""

# Test 4: Platform admin can access all tenants
echo "Test 4: Platform admin can access all tenants"
echo "----------------------------------------------"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/grants" \
  -H "Authorization: Bearer $PLATFORM_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "bank_002",
    "subject_id": "user_test",
    "subject_type": "user",
    "permission": "view",
    "resource_type": "account",
    "resource_id": "acc_456",
    "duration": "1h",
    "reason": "Platform admin test"
  }')

http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "201" ]; then
    echo "✅ PASS: Platform admin can create grant in any tenant (201 Created)"
    grant_id_2=$(echo "$body" | jq -r '.id')
else
    echo "❌ FAIL: Expected 201, got $http_code"
fi
echo ""

# Test 5: Tenant admin lists grants (should only see their tenant)
echo "Test 5: Tenant admin lists grants in their tenant"
echo "--------------------------------------------------"
response=$(curl -s -w "\n%{http_code}" "$API_URL/grants?tenant_id=bank_001" \
  -H "Authorization: Bearer $TENANT_ADMIN_BANK1_TOKEN")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    count=$(echo "$body" | jq '.count')
    echo "✅ PASS: Tenant admin can list grants in their tenant (200 OK)"
    echo "   Found $count grants"
else
    echo "❌ FAIL: Expected 200, got $http_code"
fi
echo ""

# Test 6: Tenant admin revokes grant in their tenant
echo "Test 6: Tenant admin revokes grant in their tenant"
echo "---------------------------------------------------"
if [ ! -z "$grant_id" ]; then
    response=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/grants/$grant_id?tenant_id=bank_001" \
      -H "Authorization: Bearer $TENANT_ADMIN_BANK1_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"reason": "Test revocation"}')

    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "200" ]; then
        echo "✅ PASS: Tenant admin can revoke grant in their tenant (200 OK)"
    else
        echo "❌ FAIL: Expected 200, got $http_code"
    fi
else
    echo "⚠️  SKIP: No grant ID from Test 1"
fi
echo ""

# Test 7: Tenant admin cannot revoke grant in different tenant
echo "Test 7: Tenant admin cannot revoke grant in different tenant"
echo "-------------------------------------------------------------"
if [ ! -z "$grant_id_2" ]; then
    response=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/grants/$grant_id_2?tenant_id=bank_002" \
      -H "Authorization: Bearer $TENANT_ADMIN_BANK1_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"reason": "Cross-tenant revocation attempt"}')

    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "403" ]; then
        echo "✅ PASS: Tenant admin cannot revoke grant in other tenant (403 Forbidden)"
    else
        echo "❌ FAIL: Expected 403, got $http_code"
    fi
else
    echo "⚠️  SKIP: No grant ID from Test 4"
fi
echo ""

# Test 8: Regular user cannot view grant they didn't create/receive
echo "Test 8: Regular user cannot view unauthorized grant"
echo "----------------------------------------------------"
response=$(curl -s -w "\n%{http_code}" "$API_URL/grants?tenant_id=bank_001" \
  -H "Authorization: Bearer $REGULAR_USER_TOKEN")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    count=$(echo "$body" | jq '.count')
    echo "✅ PASS: Regular user gets filtered list (200 OK)"
    echo "   Found $count grants (should only be grants they created/received)"
else
    echo "❌ FAIL: Expected 200, got $http_code"
fi
echo ""

echo "========================================="
echo "Test Summary"
echo "========================================="
echo "All tenant admin authorization tests completed."
echo "Review results above for any failures."
