/**
 * Security Enhancement Integration — Express routes for 12 security microservices
 *
 * Services:
 *   scratch-card-pin-go   :8485  Scratch card PIN generation/verification
 *   hsm-key-manager-rs    :8486  HSM key management, PIN block, DUKPT
 *   pin-block-engine-rs   :8487  ISO 9564 PIN block encryption/translation
 *   grid-token-card-go    :8488  Grid-based challenge-response cards
 *   mfa-orchestrator-go   :8489  Adaptive multi-factor authentication
 *   otp-hardening-rs      :8490  Hardened OTP with rate limiting
 *   session-security-rs   :8491  Session security, device fingerprinting
 *   api-key-vault-go      :8492  API key lifecycle management
 *   adaptive-rate-limiter-rs :8493  Adaptive rate limiting, DDoS mitigation
 *   field-level-encryption-rs :8494  Per-field AES-256-GCM encryption
 *   certificate-manager-py :8495  X.509 certificate lifecycle
 *   security-audit-logger-py :8496  Centralized security audit logging
 */

import type { Express, Request, Response } from "express";

const SERVICES = {
  scratchCard:      { host: "localhost", port: 8485, prefix: "/v1/scratch-cards" },
  hsmKeyManager:    { host: "localhost", port: 8486, prefix: "/v1/hsm" },
  pinBlockEngine:   { host: "localhost", port: 8487, prefix: "/v1/pin-blocks" },
  gridTokenCard:    { host: "localhost", port: 8488, prefix: "/v1/grid-cards" },
  mfaOrchestrator:  { host: "localhost", port: 8489, prefix: "/v1/mfa" },
  otpHardening:     { host: "localhost", port: 8490, prefix: "/v1/otp" },
  sessionSecurity:  { host: "localhost", port: 8491, prefix: "/v1/sessions" },
  apiKeyVault:      { host: "localhost", port: 8492, prefix: "/v1/api-keys" },
  rateLimiter:      { host: "localhost", port: 8493, prefix: "/v1/rate-limits" },
  fieldEncryption:  { host: "localhost", port: 8494, prefix: "/v1/encryption" },
  certManager:      { host: "localhost", port: 8495, prefix: "/v1/certificates" },
  securityAudit:    { host: "localhost", port: 8496, prefix: "/v1/security-audit" },
};

// Seed data for when services are offline
const SEED = {
  scratchCards: [
    { id: "SC-001", batchId: "BATCH-001", serialNumber: "54B-TXN-000001", cardType: "transaction_pin", status: "issued", maxAttempts: 3, usedAttempts: 0, branchCode: "LOS-001", expiresAt: "2027-01-15T10:00:00Z" },
    { id: "SC-002", batchId: "BATCH-001", serialNumber: "54B-TXN-000002", cardType: "transaction_pin", status: "used", maxAttempts: 3, usedAttempts: 1, customerName: "Adewale Ogundimu", branchCode: "LOS-001" },
    { id: "SC-003", batchId: "BATCH-002", serialNumber: "54B-GRD-000001", cardType: "grid_challenge", status: "activated", maxAttempts: 5, usedAttempts: 2, customerName: "Ngozi Okafor", branchCode: "ABJ-001" },
    { id: "SC-004", batchId: "BATCH-003", serialNumber: "54B-ACT-000001", cardType: "activation", status: "used", maxAttempts: 1, usedAttempts: 1, customerName: "Emeka Nwosu", branchCode: "PHC-001" },
    { id: "SC-005", batchId: "BATCH-004", serialNumber: "54B-VAL-000001", cardType: "prepaid_value", status: "issued", value: 50000, currency: "NGN", branchCode: "KAN-001" },
    { id: "SC-006", batchId: "BATCH-001", serialNumber: "54B-TXN-000003", cardType: "transaction_pin", status: "revoked", tamperDetected: true, branchCode: "LOS-001" },
  ],
  hsmKeys: [
    { id: "KEY-001", name: "Master PIN Encryption Key", keyType: "aes256", algorithm: "AES-256-CBC", purpose: "pin_encryption", status: "active", keySizeBits: 256, hsmSlot: "HSM-SLOT-001", usageCount: 1250000 },
    { id: "KEY-002", name: "Transaction Signing Key", keyType: "ecdsa_p256", algorithm: "ECDSA-P256-SHA256", purpose: "signing", status: "active", keySizeBits: 256, hsmSlot: "HSM-SLOT-002" },
    { id: "KEY-003", name: "DUKPT Base Derivation Key", keyType: "dukpt_bdk", algorithm: "3DES-DUKPT", purpose: "pin_derivation", status: "active", keySizeBits: 128 },
    { id: "KEY-004", name: "Data-at-Rest Encryption Key", keyType: "aes256", algorithm: "AES-256-GCM", purpose: "data_encryption", status: "active", keySizeBits: 256 },
    { id: "KEY-005", name: "Key Wrapping Key (KEK)", keyType: "aes256", algorithm: "AES-256-KW", purpose: "key_wrapping", status: "active", keySizeBits: 256 },
    { id: "KEY-006", name: "Certificate Signing Key", keyType: "rsa4096", algorithm: "RSA-4096-SHA512", purpose: "signing", status: "active", keySizeBits: 4096 },
  ],
  gridCards: [
    { id: "GC-001", customerId: "CUST-1001", customerName: "Adewale Ogundimu", cardSerial: "54B-GRID-00001", gridSize: "5x5", status: "active", usageCount: 45, branchCode: "LOS-001" },
    { id: "GC-002", customerId: "CUST-1002", customerName: "Ngozi Okafor", cardSerial: "54B-GRID-00002", gridSize: "5x5", status: "active", usageCount: 32, branchCode: "ABJ-001" },
    { id: "GC-003", customerId: "CUST-1003", customerName: "Emeka Nwosu", cardSerial: "54B-GRID-00003", gridSize: "8x4", status: "active", usageCount: 18, branchCode: "PHC-001" },
    { id: "GC-004", customerId: "CUST-1004", customerName: "Fatima Abdullahi", cardSerial: "54B-GRID-00004", gridSize: "5x5", status: "suspended", branchCode: "KAN-001" },
  ],
  mfaEnrollments: [
    { id: "MFA-E-001", customerId: "CUST-1001", methods: ["pin","biometric","otp_sms","scratch_card"], primaryMethod: "biometric", status: "active", riskLevel: "low" },
    { id: "MFA-E-002", customerId: "CUST-1002", methods: ["pin","otp_email","grid_card"], primaryMethod: "grid_card", status: "active", riskLevel: "medium" },
    { id: "MFA-E-003", customerId: "CUST-1003", methods: ["pin","otp_sms"], primaryMethod: "otp_sms", status: "active", riskLevel: "low" },
    { id: "MFA-E-004", customerId: "CUST-1004", methods: ["pin","hardware_token","biometric","otp_sms"], primaryMethod: "hardware_token", status: "active", riskLevel: "high" },
  ],
  pinBlocks: [
    { id: "PB-001", name: "ISO 9564 Format 0", format: "format_0", algorithm: "3DES", translations: 45000, status: "active" },
    { id: "PB-002", name: "ISO 9564 Format 3", format: "format_3", algorithm: "AES-128", translations: 28000, status: "active" },
  ],
  otpPolicies: [
    { id: "OTP-001", name: "Transaction OTP", length: 6, expiry: "5 min", maxAttempts: 3, channel: "sms", status: "active" },
    { id: "OTP-002", name: "Login OTP", length: 6, expiry: "10 min", maxAttempts: 5, channel: "email", status: "active" },
  ],
  sessions: [
    { id: "SES-001", name: "Web Sessions", activeSessions: 12450, maxConcurrent: 50000, avgDuration: "25min", status: "active" },
    { id: "SES-002", name: "Mobile Sessions", activeSessions: 8200, maxConcurrent: 30000, avgDuration: "45min", status: "active" },
  ],
  apiKeys: [
    { id: "KEY-API-001", name: "Mobile App Key", prefix: "54B-MOB-***", requests: "1.2M/day", status: "active" },
    { id: "KEY-API-002", name: "Partner API Key", prefix: "54B-PTR-***", requests: "450K/day", status: "active" },
  ],
  rateLimits: [
    { id: "RL-001", name: "API Rate Limit", limit: "10,000 req/min", burst: 500, window: "1 min", status: "active" },
    { id: "RL-002", name: "Login Rate Limit", limit: "5 req/min", burst: 10, window: "1 min", status: "active" },
  ],
  encryptionPolicies: [
    { id: "ENC-001", name: "AES-256-GCM at Rest", type: "symmetric", algorithm: "AES-256-GCM", fieldsProtected: 45, status: "active" },
    { id: "ENC-002", name: "RSA-4096 in Transit", type: "asymmetric", algorithm: "RSA-4096", fieldsProtected: 12, status: "active" },
  ],
  certificates: [
    { id: "CERT-001", name: "*.54bank.ng Wildcard SSL", issuer: "DigiCert", expiry: "2027-03-15", keySize: "RSA-4096", status: "active" },
    { id: "CERT-002", name: "API mTLS Certificate", issuer: "Internal CA", expiry: "2027-01-01", keySize: "ECDSA-P256", status: "active" },
  ],
  auditEvents: [
    { id: "AUD-001", name: "Login — Admin User", type: "authentication", ip: "10.0.1.45", result: "success", timestamp: "2026-05-14T10:30:00Z", status: "active" },
    { id: "AUD-002", name: "Transfer — ₦2.5M", type: "transaction", ip: "10.0.1.52", result: "success", timestamp: "2026-05-14T10:28:00Z", status: "active" },
  ],
};

async function proxyOrSeed(serviceKey: string, path: string, seedData: any, res: Response) {
  const svc = (SERVICES as any)[serviceKey];
  try {
    const resp = await fetch(`http://${svc.host}:${svc.port}${path}`);
    const data = await resp.json();
    return res.json(data);
  } catch {
    return res.json({ items: seedData, total: seedData.length, source: "seed" });
  }
}

export function registerSecurityEnhancementRoutes(app: Express) {
  // Scratch Card PIN
  app.get("/api/security/scratch-cards", (_, res) => proxyOrSeed("scratchCard", "/v1/scratch-cards", SEED.scratchCards, res));
  app.get("/api/security/scratch-cards/batches", (_, res) => proxyOrSeed("scratchCard", "/v1/scratch-cards/batches", [], res));
  app.get("/api/security/scratch-cards/verifications", (_, res) => proxyOrSeed("scratchCard", "/v1/scratch-cards/verifications", [], res));
  app.get("/api/security/scratch-cards/stats", (_, res) => proxyOrSeed("scratchCard", "/v1/scratch-cards/stats", {}, res));
  app.get("/api/security/scratch-cards/audit", (_, res) => proxyOrSeed("scratchCard", "/v1/scratch-cards/audit", [], res));

  // HSM Key Manager
  app.get("/api/security/hsm/keys", (_, res) => proxyOrSeed("hsmKeyManager", "/v1/hsm/keys", SEED.hsmKeys, res));
  app.get("/api/security/hsm/pin-blocks", (_, res) => proxyOrSeed("hsmKeyManager", "/v1/hsm/pin-blocks", [], res));
  app.get("/api/security/hsm/dukpt-terminals", (_, res) => proxyOrSeed("hsmKeyManager", "/v1/hsm/dukpt-terminals", [], res));
  app.get("/api/security/hsm/ceremonies", (_, res) => proxyOrSeed("hsmKeyManager", "/v1/hsm/ceremonies", [], res));
  app.get("/api/security/hsm/stats", (_, res) => proxyOrSeed("hsmKeyManager", "/v1/hsm/stats", {}, res));

  // PIN Block Engine
  app.get("/api/security/pin-blocks", (_, res) => proxyOrSeed("pinBlockEngine", "/v1/pin-blocks", SEED.pinBlocks, res));
  app.get("/api/security/pin-blocks/translations", (_, res) => proxyOrSeed("pinBlockEngine", "/v1/pin-blocks/translations", [], res));
  app.get("/api/security/pin-blocks/stats", (_, res) => proxyOrSeed("pinBlockEngine", "/v1/pin-blocks/stats", {}, res));

  // Grid Token Card
  app.get("/api/security/grid-cards", (_, res) => proxyOrSeed("gridTokenCard", "/v1/grid-cards", SEED.gridCards, res));
  app.get("/api/security/grid-cards/challenges", (_, res) => proxyOrSeed("gridTokenCard", "/v1/grid-cards/challenges", [], res));
  app.get("/api/security/grid-cards/stats", (_, res) => proxyOrSeed("gridTokenCard", "/v1/grid-cards/stats", {}, res));

  // MFA Orchestrator
  app.get("/api/security/mfa/enrollments", (_, res) => proxyOrSeed("mfaOrchestrator", "/v1/mfa/enrollments", SEED.mfaEnrollments, res));
  app.get("/api/security/mfa/policies", (_, res) => proxyOrSeed("mfaOrchestrator", "/v1/mfa/policies", [], res));
  app.get("/api/security/mfa/verifications", (_, res) => proxyOrSeed("mfaOrchestrator", "/v1/mfa/verifications", [], res));
  app.get("/api/security/mfa/stats", (_, res) => proxyOrSeed("mfaOrchestrator", "/v1/mfa/stats", {}, res));

  // OTP Hardening
  app.get("/api/security/otp/policies", (_, res) => proxyOrSeed("otpHardening", "/v1/otp/policies", SEED.otpPolicies, res));
  app.get("/api/security/otp/records", (_, res) => proxyOrSeed("otpHardening", "/v1/otp/records", [], res));
  app.get("/api/security/otp/stats", (_, res) => proxyOrSeed("otpHardening", "/v1/otp/stats", {}, res));

  // Session Security
  app.get("/api/security/sessions", (_, res) => proxyOrSeed("sessionSecurity", "/v1/sessions", SEED.sessions, res));
  app.get("/api/security/sessions/policies", (_, res) => proxyOrSeed("sessionSecurity", "/v1/sessions/policies", [], res));
  app.get("/api/security/sessions/stats", (_, res) => proxyOrSeed("sessionSecurity", "/v1/sessions/stats", {}, res));

  // API Key Vault
  app.get("/api/security/api-keys", (_, res) => proxyOrSeed("apiKeyVault", "/v1/api-keys", SEED.apiKeys, res));
  app.get("/api/security/api-keys/usage", (_, res) => proxyOrSeed("apiKeyVault", "/v1/api-keys/usage", [], res));
  app.get("/api/security/api-keys/stats", (_, res) => proxyOrSeed("apiKeyVault", "/v1/api-keys/stats", {}, res));

  // Adaptive Rate Limiter
  app.get("/api/security/rate-limits/policies", (_, res) => proxyOrSeed("rateLimiter", "/v1/rate-limits/policies", SEED.rateLimits, res));
  app.get("/api/security/rate-limits/events", (_, res) => proxyOrSeed("rateLimiter", "/v1/rate-limits/events", [], res));
  app.get("/api/security/rate-limits/stats", (_, res) => proxyOrSeed("rateLimiter", "/v1/rate-limits/stats", {}, res));

  // Field-Level Encryption
  app.get("/api/security/encryption/policies", (_, res) => proxyOrSeed("fieldEncryption", "/v1/encryption/policies", SEED.encryptionPolicies, res));
  app.get("/api/security/encryption/audit", (_, res) => proxyOrSeed("fieldEncryption", "/v1/encryption/audit", [], res));
  app.get("/api/security/encryption/stats", (_, res) => proxyOrSeed("fieldEncryption", "/v1/encryption/stats", {}, res));

  // Certificate Manager
  app.get("/api/security/certificates", (_, res) => proxyOrSeed("certManager", "/v1/certificates", SEED.certificates, res));
  app.get("/api/security/certificates/crl", (_, res) => proxyOrSeed("certManager", "/v1/certificates/crl", [], res));
  app.get("/api/security/certificates/stats", (_, res) => proxyOrSeed("certManager", "/v1/certificates/stats", {}, res));

  // Security Audit Logger
  app.get("/api/security/audit/events", (_, res) => proxyOrSeed("securityAudit", "/v1/security-audit/events", SEED.auditEvents, res));
  app.get("/api/security/audit/alerts", (_, res) => proxyOrSeed("securityAudit", "/v1/security-audit/alerts", [], res));
  app.get("/api/security/audit/retention", (_, res) => proxyOrSeed("securityAudit", "/v1/security-audit/retention", [], res));
  app.get("/api/security/audit/stats", (_, res) => proxyOrSeed("securityAudit", "/v1/security-audit/stats", {}, res));
}
