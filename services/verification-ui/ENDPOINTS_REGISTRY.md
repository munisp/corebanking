# 🌐 APISIX Endpoints Registry

**Verification Service Integration**
**Document:** Centralized route registry for all verification endpoints

---

## 📋 Routes Summary

| # | Step | Endpoint | Method | Purpose | UI File | Status |
|----|------|----------|--------|---------|---------|--------|
| 1 | Setup | `/api/v1/countries` | GET | List all countries | `Step1CountrySelection.tsx` | 🟡 Backend Pending |
| 2 | Setup | `/api/v1/countries/{code}/config` | GET | Country document config | `Step1CountrySelection.tsx` | 🟡 Backend Pending |
| 3 | Session | `/api/v1/verification/initialize` | POST | Create verification session | `useVerificationFlow.ts` | 🟡 Backend Pending |
| 4 | Session | `/api/v1/verification/{id}/session` | GET | Get session state | `useVerificationFlow.ts` | 🟡 Backend Pending |
| 5 | Session | `/api/v1/verification/{id}/session` | PATCH | Update session | `useVerificationFlow.ts` | 🟡 Backend Pending |
| 6 | Upload | `/api/v1/verification/{id}/documents/upload` | POST | Upload document image | `Step3DocumentCapture.tsx` | 🟡 Backend Pending |
| 7 | OCR | `/api/v1/verification/{id}/documents/ocr` | POST | Process OCR | `Step3DocumentCapture.tsx` | 🟡 Backend Pending |
| 8 | OCR | `/api/v1/verification/{id}/documents/ocr/{jobId}` | GET | Poll OCR result | `Step3DocumentCapture.tsx` | 🟡 Backend Pending |
| 9 | Biometric | `/api/v1/verification/{id}/biometric/face-match` | POST | Verify face match | `Step4FaceVerification.tsx` | 🟡 Backend Pending |
| 10 | Biometric | `/api/v1/verification/{id}/biometric/liveness` | POST | Verify liveness | `Step4FaceVerification.tsx` | 🟡 Backend Pending |
| 11 | Submit | `/api/v1/verification/{id}/submit` | POST | Submit verification | `Step4FaceVerification.tsx` | 🟡 Backend Pending |
| 12 | Status | `/api/v1/verification/{id}/status` | GET | Get verification status | `VerificationFlow.tsx` | 🟡 Backend Pending |
| 13 | **Legacy** | `/kyc/verify` | POST | **Legacy all-in-one** (active fallback) | `Step4FaceVerification.tsx` | ✅ **Live** |

---

## 📐 UI Component → Endpoint Map

| Component | APISIX Route | Purpose |
|-----------|-------------|---------|
| `Step1CountrySelection.tsx` | `GET /api/v1/countries` | Loads searchable country list |
| `Step1CountrySelection.tsx` | `GET /api/v1/countries/{code}/config` | Loads document types + OCR rules |
| `useVerificationFlow.ts` | `POST /api/v1/verification/initialize` | Creates session on app load |
| `Step3DocumentCapture.tsx` | `POST /api/v1/verification/{id}/documents/upload` | Uploads front/back images |
| `Step3DocumentCapture.tsx` | `POST /api/v1/verification/{id}/documents/ocr` | Triggers OCR job |
| `Step3DocumentCapture.tsx` | `GET /api/v1/verification/{id}/documents/ocr/{jobId}` | Polls OCR result every 2s |
| `Step4FaceVerification.tsx` | `POST /api/v1/verification/{id}/biometric/liveness` | Submits liveness proof |
| `Step4FaceVerification.tsx` | `POST /api/v1/verification/{id}/biometric/face-match` | Face match selfie vs. document |
| `Step4FaceVerification.tsx` | `POST /api/v1/verification/{id}/submit` | Final verification submit |
| `Step4FaceVerification.tsx` | `POST /kyc/verify` | **Fallback** if new endpoints 404 |

---

## 🔑 Authentication

All new endpoints require:
```
Header: X-API-KEY: {KYC_FLOW_API_KEY}
Header: Content-Type: application/json
```

Legacy endpoint also accepts:
```
Header: Authorization: {KYC_FLOW_API_KEY}
```

The `verificationAPI` service sets **both** headers on every request for compatibility.

---

## 📝 Detailed Endpoint Specifications

### 1️⃣ GET `/api/v1/countries`

**Purpose:** Get list of supported countries

**Request:**
```bash
curl -X GET https://54link-dev.upi.dev/verification/api/v1/countries \
  -H "X-API-KEY: {API_KEY}"
```

**Response:** `200 OK`
```json
{
  "countries": [
    { "code": "NG", "name": "Nigeria",        "flag": "🇳🇬", "callingCode": "+234", "region": "Africa",  "popular": true },
    { "code": "GB", "name": "United Kingdom", "flag": "🇬🇧", "callingCode": "+44",  "region": "Europe",  "popular": true },
    { "code": "US", "name": "United States",  "flag": "🇺🇸", "callingCode": "+1",   "region": "America", "popular": true },
    { "code": "GH", "name": "Ghana",          "flag": "🇬🇭", "callingCode": "+233", "region": "Africa",  "popular": true },
    { "code": "KE", "name": "Kenya",          "flag": "🇰🇪", "callingCode": "+254", "region": "Africa",  "popular": true }
  ],
  "lastUpdated": 1748390400000
}
```

---

### 2️⃣ GET `/api/v1/countries/{code}/config`

**Purpose:** Country-specific document requirements and OCR configuration

**Response:** `200 OK`
```json
{
  "countryCode": "NG",
  "config": {
    "countryCode": "NG",
    "supportedDocuments": ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE", "BVN", "NIN"],
    "documentRequirements": [
      {
        "type": "NATIONAL_ID",
        "name": "National ID",
        "description": "Valid Nigerian National Identification Number (NIN)",
        "requiredSides": "both",
        "ocrCapable": true,
        "maxFileSize": 10485760,
        "allowedFormats": ["image/jpeg", "image/png"],
        "validationRules": { "minDPI": 300, "expiryCheck": true },
        "recommended": true,
        "processingProvider": "google_vision"
      },
      {
        "type": "PASSPORT",
        "name": "International Passport",
        "description": "Valid Nigerian international passport",
        "requiredSides": "front",
        "ocrCapable": true,
        "maxFileSize": 10485760,
        "allowedFormats": ["image/jpeg", "image/png"],
        "validationRules": { "requireMRZ": true, "expiryCheck": true },
        "recommended": false,
        "processingProvider": "google_vision"
      },
      {
        "type": "DRIVERS_LICENSE",
        "name": "Driver's License",
        "description": "Valid Nigerian driver's license",
        "requiredSides": "both",
        "ocrCapable": true,
        "maxFileSize": 10485760,
        "allowedFormats": ["image/jpeg", "image/png"],
        "recommended": false
      }
    ],
    "ocrProvider": "google_vision",
    "verificationProvider": "internal",
    "rules": { "requireFaceMatch": true, "requireLivenessCheck": true, "maxRetries": 3 }
  }
}
```

---

### 3️⃣ POST `/api/v1/verification/initialize`

**Purpose:** Create a new verification session

**Request:**
```json
{
  "metadata": {
    "source": "web",
    "deviceId": "device_12345",
    "userId": "user_67890"
  }
}
```

**Response:** `201 Created`
```json
{
  "verificationId": "ver_1748390400000_abc123",
  "sessionId": "sess_1748390400000_xyz789",
  "status": "pending",
  "createdAt": 1748390400000,
  "expiresAt": 1748394000000,
  "currentStep": 1
}
```

---

### 4️⃣ GET `/api/v1/verification/{verificationId}/session`

**Response:** `200 OK`
```json
{
  "sessionId": "sess_xyz789",
  "verificationId": "ver_abc123",
  "currentStep": 3,
  "status": "processing",
  "country": { "code": "NG", "name": "Nigeria", "flag": "🇳🇬" },
  "selectedDocumentType": "NATIONAL_ID",
  "createdAt": 1748390400000,
  "updatedAt": 1748390700000,
  "expiresAt": 1748394000000,
  "attemptCount": 1
}
```

---

### 5️⃣ PATCH `/api/v1/verification/{verificationId}/session`

**Request:**
```json
{
  "currentStep": 3,
  "selectedCountry": "NG",
  "selectedDocumentType": "NATIONAL_ID"
}
```

**Response:** `200 OK`
```json
{
  "sessionId": "sess_xyz789",
  "verificationId": "ver_abc123",
  "currentStep": 3,
  "status": "processing",
  "updatedAt": 1748390800000
}
```

---

### 6️⃣ POST `/api/v1/verification/{verificationId}/documents/upload`

**Purpose:** Upload document image (multipart/form-data)

**Request:**
```
Content-Type: multipart/form-data
Fields:
  document: <image file>
  side:     "front" | "back"
```

**Response:** `200 OK`
```json
{
  "documentId": "doc_front_12345",
  "side": "front",
  "uploadedAt": 1748390900000,
  "fileSize": 2097152,
  "mimeType": "image/jpeg"
}
```

---

### 7️⃣ POST `/api/v1/verification/{verificationId}/documents/ocr`

**Purpose:** Trigger OCR on uploaded documents

**Request:**
```json
{
  "documentIds": ["doc_front_12345", "doc_back_67890"],
  "documentType": "NATIONAL_ID"
}
```

**Response:** `202 Accepted`
```json
{
  "status": "processing",
  "jobId": "ocr_job_abc123",
  "estimatedTimeMs": 3000
}
```

---

### 8️⃣ GET `/api/v1/verification/{verificationId}/documents/ocr/{jobId}`

**Response (Completed):** `200 OK`
```json
{
  "status": "completed",
  "jobId": "ocr_job_abc123",
  "result": {
    "confidence": 0.95,
    "provider": "google_vision",
    "extractedData": {
      "fullName": "John Doe",
      "firstName": "John",
      "lastName": "Doe",
      "dateOfBirth": "1990-01-01",
      "documentNumber": "1234567890",
      "expiryDate": "2030-01-01",
      "issuingDate": "2020-01-01",
      "nationality": "NG",
      "gender": "M",
      "address": "123 Main St, Lagos, NG",
      "faceImageBase64": "data:image/jpeg;base64,..."
    },
    "validations": {
      "isExpired": false,
      "isBlurry": false,
      "isCropped": false,
      "hasGlare": false,
      "isComplete": true
    }
  }
}
```

**Response (Failed):** `200 OK`
```json
{
  "status": "failed",
  "jobId": "ocr_job_abc123",
  "error": "Document too blurry for OCR processing"
}
```

---

### 9️⃣ POST `/api/v1/verification/{verificationId}/biometric/face-match`

**Request:**
```json
{
  "selfieImage": "data:image/jpeg;base64,...",
  "documentFaceImage": "data:image/jpeg;base64,..."
}
```

**Response:** `200 OK`
```json
{
  "matched": true,
  "confidence": 0.98,
  "provider": "internal",
  "details": {
    "faceQuality": 0.95,
    "livenessCheck": "passed",
    "imageQuality": "high"
  }
}
```

---

### 🔟 POST `/api/v1/verification/{verificationId}/biometric/liveness`

**Request:**
```json
{
  "frames": [],
  "proof": {
    "verdict": "VERIFIED",
    "confidence": 0.92,
    "signals": {
      "motion": 0.65,
      "challengePassed": true,
      "score": 0.88
    },
    "hash": "sha256:..."
  }
}
```

**Response:** `200 OK`
```json
{
  "live": true,
  "confidence": 0.92,
  "provider": "internal_engine",
  "methods": {
    "blink": true,
    "headMovement": true,
    "smileChallenge": false
  }
}
```

---

### 1️⃣1️⃣ POST `/api/v1/verification/{verificationId}/submit`

**Request:**
```json
{
  "documentVerified": true,
  "faceMatched": true,
  "livenessVerified": true,
  "metadata": { "browser": "Chrome", "os": "macOS" }
}
```

**Response:** `200 OK`
```json
{
  "status": "verified",
  "verificationId": "ver_abc123",
  "message": "Verification successful",
  "nextStep": null
}
```

---

### 1️⃣2️⃣ GET `/api/v1/verification/{verificationId}/status`

**Response:** `200 OK`
```json
{
  "verificationId": "ver_abc123",
  "status": "verified",
  "country": "NG",
  "documentType": "NATIONAL_ID",
  "ocrConfidence": 0.95,
  "faceMatchConfidence": 0.98,
  "livenessScore": 0.92,
  "completedAt": 1748391200000,
  "auditTrail": [
    { "action": "country_selected",   "timestamp": 1748390400000, "step": 1 },
    { "action": "document_selected",  "timestamp": 1748390500000, "step": 2 },
    { "action": "document_uploaded",  "timestamp": 1748390700000, "step": 3 },
    { "action": "ocr_completed",      "timestamp": 1748390900000, "step": 3 },
    { "action": "liveness_passed",    "timestamp": 1748391100000, "step": 4 },
    { "action": "face_matched",       "timestamp": 1748391150000, "step": 4 },
    { "action": "verification_done",  "timestamp": 1748391200000, "step": 4 }
  ]
}
```

---

### 1️⃣3️⃣ POST `/kyc/verify` ⚡ **Active Fallback**

**Purpose:** Legacy all-in-one KYC submission (currently the only live endpoint)

**Request:**
```json
{
  "endUserInfo": { "id": "ver_abc123" },
  "document": {
    "type": "id_card",
    "country": "NG",
    "frontImage": "data:image/jpeg;base64,...",
    "backImage":  "data:image/jpeg;base64,..."
  },
  "selfie": { "image": "data:image/jpeg;base64,..." },
  "livenessProof": {
    "sessionId": "sess_xyz",
    "timestamp": 1748391100000,
    "confidence": 0.92,
    "verdict": "VERIFIED",
    "signals": { "motion": 0.65, "challengePassed": true, "score": 0.88 },
    "hash": "sha256:..."
  },
  "metadata": { "tenant_id": "t1", "keycloak_id": "kc_u1" }
}
```

**Headers:**
```
Authorization: {KYC_FLOW_API_KEY}
X-API-KEY:     {KYC_FLOW_API_KEY}
x-tenant-id:   {tenant_id}   (from metadata)
x-keycloak-id: {keycloak_id} (from metadata)
```

---

## 🛡️ Error Responses

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Request validation failed",
    "details": "Field 'documentType' is required"
  }
}
```

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_REQUEST` | 400 | Bad request format |
| `UNAUTHORIZED` | 401 | Missing/invalid API key |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate/conflicting state |
| `RATE_LIMIT` | 429 | Too many requests |
| `PROVIDER_ERROR` | 502 | External provider error |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 📊 Implementation Status

| Endpoint | Backend Status | UI Status | Notes |
|----------|---------------|-----------|-------|
| `GET  /countries` | 🟡 To Do | ✅ Wired | Fallback: empty list shown |
| `GET  /countries/{code}/config` | 🟡 To Do | ✅ Wired | Fallback: error banner |
| `POST /initialize` | 🟡 To Do | ✅ Wired | Fallback: local session |
| `GET/PATCH /session` | 🟡 To Do | ✅ Wired | State stored locally |
| `POST /documents/upload` | 🟡 To Do | ✅ Wired | Fallback: continue without upload |
| `POST /documents/ocr` | 🟡 To Do | ✅ Wired | Fallback: skip OCR |
| `GET  /documents/ocr/{jobId}` | 🟡 To Do | ✅ Wired | Polled every 2s |
| `POST /biometric/face-match` | 🟡 To Do | ✅ Wired | Fallback: skip face match |
| `POST /biometric/liveness` | 🟡 To Do | ✅ Wired | Fallback: legacy submit |
| `POST /submit` | 🟡 To Do | ✅ Wired | Fallback: legacy submit |
| `GET  /status` | 🟡 To Do | ✅ Wired | Poll-ready |
| `POST /kyc/verify` | ✅ **Live** | ✅ Active | Primary fallback for Step 4 |

---

## 🔗 Service References

- **Verification UI:** `services/verification-ui/src/services/verificationAPI.ts`
- **Flow Hook:**       `services/verification-ui/src/hooks/useVerificationFlow.ts`
- **Step 1:**          `services/verification-ui/src/components/steps/Step1CountrySelection.tsx`
- **Step 2:**          `services/verification-ui/src/components/steps/Step2DocumentSelection.tsx`
- **Step 3:**          `services/verification-ui/src/components/steps/Step3DocumentCapture.tsx`
- **Step 4:**          `services/verification-ui/src/components/steps/Step4FaceVerification.tsx`
- **Container:**       `services/verification-ui/src/components/steps/VerificationFlow.tsx`
- **Backend:**         `services/verification-service/src/`

---

**Last Updated:** May 27, 2026
**API Version:** v1
**Base URL:** `https://54link-dev.upi.dev/verification`
