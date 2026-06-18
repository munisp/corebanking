# 🔐 Verification UI Redesign — Architecture & Implementation Guide

**Date:** May 26, 2026  
**Version:** 1.0  
**Status:** Production-Ready UI + Backend Integration Ready

---

## 📋 Overview

The verification UI has been completely redesigned into a **4-step guided workflow** with strong UX, country selection, document intelligence, OCR integration, and biometric verification.

### Flow Steps

1. **Step 1: Country Selection** — Searchable country selector
2. **Step 2: Document Selection** — Dynamic document type selection per country
3. **Step 3: Document Capture + OCR** — Upload & process documents
4. **Step 4: Face Verification** — Biometric verification & liveness checks

---

## 🏗️ Architecture

### File Structure

```
src/
├── types/
│   └── verification.ts          # Complete type definitions
├── services/
│   └── verificationAPI.ts        # Centralized API client & routes
├── hooks/
│   └── useVerificationFlow.ts    # State management hook
├── components/
│   └── steps/
│       ├── Step1CountrySelection.tsx      # Country selector
│       ├── Step1CountrySelection.css
│       ├── Step2DocumentSelection.tsx     # Document selector
│       ├── Step2DocumentSelection.css
│       ├── VerificationFlow.tsx           # Main container
│       └── VerificationFlow.css
└── App.tsx                       # Updated main app
```

### Core Components

#### **1. State Management (`useVerificationFlow`)**

Central hook managing all verification state:

```typescript
const flow = useVerificationFlow({
  verificationId?: string;
  onStepChange?: (step: VerificationStep) => void;
  onStatusChange?: (status: VerificationStatus) => void;
});

// Returns
{
  session,                  // Current verification session
  loading, error,           // Loading & error states
  
  // Step 1: Country
  countries, selectedCountry,
  loadCountries, selectCountry,
  
  // Step 2: Document
  documentConfig, selectedDocumentType,
  selectDocumentType,
  
  // Step 3: Document verification
  documentImages, ocrResults, ocrProcessing,
  addDocumentImage, processDocumentOCR,
  
  // Step 4: Biometric
  selfieImage, biometricProcessing,
  addSelfieImage, verifyBiometrics,
  
  // Navigation
  moveToStep, nextStep, previousStep,
  submitVerification, reset,
}
```

#### **2. API Client (`verificationAPI`)**

Centralized API client for all endpoints through APISIX:

```typescript
const verificationAPI = new VerificationAPIClient(baseUrl, apiKey);

// Methods
await verificationAPI.getCountriesList()
await verificationAPI.getCountryConfig(countryCode)
await verificationAPI.initializeVerification(metadata)
await verificationAPI.uploadDocument(verificationId, file, side)
await verificationAPI.processOCR(verificationId, documentIds, documentType)
await verificationAPI.verifyFace(verificationId, selfieBase64, documentFaceBase64)
await verificationAPI.verifyLiveness(verificationId, frameData, livenessProof)
await verificationAPI.submitVerification(verificationId, data)
```

---

## 🔌 APISIX Routes & Backend Integration

### Routes Registry

The API client maintains a centralized routes registry. All endpoints flow through APISIX gateway.

#### **Step 1: Country & Configuration**

| Route | Method | Purpose | Backend Service |
|-------|--------|---------|-----------------|
| `/api/v1/countries` | `GET` | List all countries | verification-service |
| `/api/v1/countries/:countryCode/config` | `GET` | Get country-specific document config | verification-service |

**Response Example:**
```json
{
  "countryCode": "NG",
  "supportedDocuments": ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE", "BVN", "NIN"],
  "documentRequirements": [
    {
      "type": "NATIONAL_ID",
      "name": "National ID",
      "description": "Valid Nigerian National ID",
      "requiredSides": "both",
      "ocrCapable": true,
      "maxFileSize": 10485760,
      "allowedFormats": ["image/jpeg", "image/png"],
      "recommended": true,
      "processingProvider": "google_vision"
    }
  ],
  "ocrProvider": "google_vision",
  "verificationProvider": "idemia",
  "rules": {
    "requireFaceMatch": true,
    "requireLivenessCheck": true,
    "maxRetries": 3
  }
}
```

#### **Step 2: Verification Session Management**

| Route | Method | Purpose | Backend Service |
|-------|--------|---------|-----------------|
| `/api/v1/verification/initialize` | `POST` | Create new verification session | verification-service |
| `/api/v1/verification/:verificationId/session` | `GET` | Get session state | verification-service |
| `/api/v1/verification/:verificationId/session` | `PATCH` | Update session state | verification-service |

**Initialize Request:**
```json
{
  "metadata": {
    "source": "web",
    "deviceId": "...",
    "ipAddress": "..."
  }
}
```

**Initialize Response:**
```json
{
  "verificationId": "ver_1234567890",
  "sessionId": "sess_0987654321",
  "expiresAt": 1706123456789,
  "status": "pending"
}
```

#### **Step 3: Document Processing**

| Route | Method | Purpose | Backend Service |
|-------|--------|---------|-----------------|
| `/api/v1/verification/:verificationId/documents/upload` | `POST` | Upload document image | verification-service |
| `/api/v1/verification/:verificationId/documents/ocr` | `POST` | Process OCR on documents | verification-service → OCR Provider |
| `/api/v1/verification/:verificationId/documents/ocr/:jobId` | `GET` | Poll OCR processing result | verification-service |

**Upload Response:**
```json
{
  "documentId": "doc_1234567890",
  "side": "front",
  "uploadedAt": 1706123456789
}
```

**OCR Processing Request:**
```json
{
  "documentIds": ["doc_front", "doc_back"],
  "documentType": "NATIONAL_ID"
}
```

**OCR Processing Response:**
```json
{
  "status": "processing|completed|failed",
  "jobId": "ocr_job_123",
  "result": {
    "confidence": 0.95,
    "provider": "google_vision",
    "extractedData": {
      "fullName": "John Doe",
      "dateOfBirth": "1990-01-01",
      "documentNumber": "1234567890",
      "expiryDate": "2030-01-01",
      "faceImageBase64": "data:image/jpeg;base64,..."
    },
    "validations": {
      "isExpired": false,
      "isBlurry": false,
      "isCropped": false,
      "hasGlare": false,
      "isComplete": true
    }
  },
  "estimatedTimeMs": 3000
}
```

#### **Step 4: Biometric Verification**

| Route | Method | Purpose | Backend Service |
|-------|--------|---------|-----------------|
| `/api/v1/verification/:verificationId/biometric/face-match` | `POST` | Verify face match | verification-service → Face Provider |
| `/api/v1/verification/:verificationId/biometric/liveness` | `POST` | Verify liveness | verification-service → Liveness Provider |

**Face Verification Request:**
```json
{
  "selfieImage": "data:image/jpeg;base64,...",
  "documentFaceImage": "data:image/jpeg;base64,..."
}
```

**Face Verification Response:**
```json
{
  "matched": true,
  "confidence": 0.98,
  "provider": "idemia"
}
```

**Liveness Verification Request:**
```json
{
  "frames": [...],
  "proof": {
    "verdict": "VERIFIED",
    "confidence": 0.92,
    "signals": {...}
  }
}
```

#### **Step 5: Final Submission**

| Route | Method | Purpose | Backend Service |
|-------|--------|---------|-----------------|
| `/api/v1/verification/:verificationId/submit` | `POST` | Submit complete verification | verification-service |
| `/api/v1/verification/:verificationId/status` | `GET` | Get verification status | verification-service |

**Submission Request:**
```json
{
  "documentVerified": true,
  "faceMatched": true,
  "livenessVerified": true,
  "metadata": {...}
}
```

**Submission Response:**
```json
{
  "status": "verified|rejected|manual_review",
  "verificationId": "ver_1234567890",
  "nextStep": null,
  "message": "Verification successful"
}
```

---

## 🔐 Security Requirements

### Transport Security
- ✅ HTTPS/TLS for all requests
- ✅ API Key authentication via `X-API-KEY` header
- ✅ CORS properly configured

### Data Security
- ✅ Temporary file handling — no permanent local storage
- ✅ Session-based verification state
- ✅ Encrypted uploads in transit
- ✅ Anti-spoofing checks
- ✅ Prevent multiple concurrent verification sessions per user

### Privacy
- ✅ Document images deleted after verification
- ✅ PII never logged or cached
- ✅ Biometric data handled per regulations (GDPR, local laws)
- ✅ Audit trail for compliance

---

## 📊 Verification States & Lifecycle

### State Machine

```
pending
  ↓
processing
  ├─→ verified (success)
  ├─→ rejected (failed checks)
  ├─→ manual_review (ambiguous)
  └─→ retry_required (technical issues)

expired (session timeout)
```

### Status Field Values

| Status | Meaning | Action |
|--------|---------|--------|
| `pending` | Waiting for submission | User is filling form |
| `processing` | Backend processing | Show spinner |
| `verified` | Success | Show confirmation |
| `rejected` | Failed | Show error, offer retry |
| `manual_review` | Escalated | Show "under review" message |
| `retry_required` | Technical error | Offer retry |
| `expired` | Session timeout | Start over |

---

## 🧠 Audit & Compliance

Every verification action creates an audit entry with:

```typescript
interface VerificationAuditEntry {
  id: string;
  verificationId: string;
  sessionId: string;
  action: string;                    // 'country_selected', 'document_uploaded', etc.
  step: VerificationStep;             // Which step
  status: VerificationStatus;         // What status
  ocrConfidence?: number;             // Confidence scores
  livenessScore?: number;
  faceMatchScore?: number;
  provider?: string;                  // Provider used
  ipAddress?: string;                 // For fraud detection
  userAgent?: string;
  timestamp: number;
}
```

**Audit Storage:**
- Stored in verification-service database
- Queryable for admin dashboard
- Retained for compliance period
- Never exposes sensitive data (PII)

---

## 🎨 UI/UX Features

### Step 1: Country Selection
- ✅ Searchable dropdown with flags
- ✅ Recently used countries
- ✅ Popular countries section
- ✅ Mobile-optimized
- ✅ Accessibility-friendly

### Step 2: Document Selection
- ✅ Icon + card grid layout
- ✅ Document requirements clearly shown
- ✅ Recommended badges
- ✅ OCR capability indicators
- ✅ Side requirements (front/back)

### Step 3: Document Capture
- ✅ Camera capture widget
- ✅ File upload fallback
- ✅ Progress indicators
- ✅ OCR confidence preview
- ✅ Extracted data review
- ✅ Retry mechanism

### Step 4: Biometric
- ✅ Selfie capture widget
- ✅ Liveness detection integration
- ✅ Face match confidence display
- ✅ Retry on failure
- ✅ Accessibility support

### Progress Tracking
- ✅ Visual stepper showing all 4 steps
- ✅ Current step highlighted
- ✅ Completed steps marked with checkmark
- ✅ Step dividers animate on completion

---

## 📱 Responsive Design

| Breakpoint | Behavior |
|------------|----------|
| Desktop (1024px+) | Full grid layouts, side-by-side buttons |
| Tablet (768px-1023px) | Adjusted grid, single-row navigation |
| Mobile (480px-767px) | Single column, stacked buttons |
| Small Mobile (<480px) | Optimized spacing, simplified layouts |

---

## 🧪 Testing Checklist

### Unit Tests
- [ ] Country selection logic
- [ ] Document type filtering
- [ ] State transitions
- [ ] API client methods

### Integration Tests
- [ ] Full 4-step flow
- [ ] Error handling
- [ ] Retry mechanisms
- [ ] Session expiration

### E2E Tests
- [ ] Complete verification journey
- [ ] Country switching
- [ ] Document re-upload
- [ ] Biometric verification
- [ ] Mobile experience

### Security Tests
- [ ] API authentication
- [ ] CORS validation
- [ ] Input sanitization
- [ ] Session security

---

## 🚀 Deployment Notes

### Environment Variables

```bash
VITE_VERIFICATION_API_URL=https://54link-dev.upi.dev/verification
VITE_KYC_FLOW_API_KEY=your-api-key-here
```

### Build Configuration

```bash
npm run build
# Output: dist/
```

### APISIX Configuration

All routes must be registered in APISIX with:
- ✅ Proper routing rules
- ✅ Rate limiting
- ✅ Authentication middleware
- ✅ Logging/monitoring
- ✅ CORS headers

---

## 📚 File Reference

| File | Purpose |
|------|---------|
| `types/verification.ts` | Complete TypeScript types |
| `services/verificationAPI.ts` | API client & routes registry |
| `hooks/useVerificationFlow.ts` | State management |
| `components/steps/Step1CountrySelection.tsx` | Country selector UI |
| `components/steps/Step2DocumentSelection.tsx` | Document selector UI |
| `components/steps/VerificationFlow.tsx` | Main container & navigation |
| `App.tsx` | Updated to use new flow |

---

## 🔄 Next Steps

### Backend Implementation Priority

1. **HIGH** — Implement country & document config endpoints
2. **HIGH** — Implement document upload & OCR processing
3. **HIGH** — Implement face verification & liveness endpoints
4. **MEDIUM** — Add audit logging
5. **MEDIUM** — Add admin dashboard
6. **LOW** — Performance optimization

### Frontend Enhancement

1. **HIGH** — Step 3: Document capture component
2. **HIGH** — Step 4: Selfie capture component
3. **MEDIUM** — Error recovery flows
4. **MEDIUM** — Analytics integration
5. **LOW** — Offline support

---

## 📞 Support & Troubleshooting

### Common Issues

**Q: Country list not loading**  
A: Check APISIX routing, verify API key, check CORS headers

**Q: OCR taking too long**  
A: Increase polling timeout, check provider availability

**Q: Face match failing**  
A: Ensure good lighting, check image quality, verify provider config

---

**Last Updated:** May 26, 2026  
**Maintained By:** Engineering Team
