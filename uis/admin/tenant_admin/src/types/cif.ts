export interface CIFAddress {
  type: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country: string;
  postCode: string;
  verified: boolean;
  isPrimary: boolean;
}

export interface CIFContact {
  type: string;
  value: string;
  verified: boolean;
  isPrimary: boolean;
}

export interface CIFRelationship {
  type: string;
  relatedCifId: string;
  relatedName: string;
}

export interface KYCDoc {
  type: string;
  number: string;
  verified: boolean;
  expiryDate: string;
}

export interface CIF {
  id: string;
  bvn: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  kycTier: number;
  status: string;
  addresses: CIFAddress[];
  contacts: CIFContact[];
  relationships: CIFRelationship[];
  kycDocuments: KYCDoc[];
  accountCount: number;
  totalBalance: number;
}

export interface CIFListResponse {
  items: CIF[];
  total: number;
}

export interface CIFStats {
  totalCIFs: number;
  totalAccounts: number;
  totalBalance: number;
  totalKYCDocuments: number;
  avgKYCTier: number;
  addressTypes: string[];
}
