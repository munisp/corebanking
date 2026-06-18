export type ConsentType = 'ais' | 'pis' | 'cbpii';
export type ConsentStatus = 'awaiting_authorization' | 'authorized' | 'rejected' | 'revoked' | 'expired';
export type TPPRole = 'aisp' | 'pisp' | 'cbpii' | 'aspsp';
export type TPPStatus = 'active' | 'suspended' | 'revoked';

export interface OBConsent {
  id: string;
  customerId: string;
  customerName: string;
  tppId: string;
  tppName: string;
  consentType: ConsentType;
  permissions: string[];
  status: ConsentStatus;
  createdAt: string;
  expiresAt: string;
  lastAccessedAt?: string;
  accessCount: number;
  accounts: string[];
}

export interface OBConsentListResponse {
  items: OBConsent[];
  total: number;
}

export interface TPP {
  id: string;
  tppName: string;
  registrationNo: string;
  role: TPPRole;
  status: TPPStatus;
  certIssuer: string;
  certExpiry: string;
  redirectUris: string[];
  contactEmail: string;
  apiVersions: string[];
  consentCount: number;
}

export interface TPPListResponse {
  items: TPP[];
  total: number;
}

export interface OBAPIEndpoint {
  id: string;
  path: string;
  method: string;
  category: string;
  version: string;
  description: string;
  rateLimit: number;
  authType: string;
}

export interface OBAPIEndpointListResponse {
  items: OBAPIEndpoint[];
  total: number;
}

export interface OpenBankingStats {
  totalConsents: number;
  activeConsents: number;
  totalTPPs: number;
  activeTPPs: number;
  totalAPIAccesses: number;
  apiEndpoints: number;
  byConsentType: Record<string, number>;
}

export interface CreateConsentPayload {
  customerId: string;
  tppId: string;
  consentType: ConsentType;
  permissions: string[];
  accounts: string[];
}
