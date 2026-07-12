export enum CustomerStatuses {
  onboarding = "onboarding",
  during_pilot = "during_pilot",
  active = "active",
  terminated = "terminated",
}

export enum VerificationWorkflowStatus {
  NOT_STARTED = "not-started",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum KycIdentityProviders {
  SHIELD = "shield",
  MOSIP = "mosip",
  DEFAULT = "default",
  LIVENESS = "liveness",
  BUSINESS_KYB = "business_kyb",
}

export enum KycVerificationImageTypeEnum {
  FACE = "face",
  ID_CARD = "id_card",
  DRIVERS_LICENSE = "drivers_license",
}

export enum KycDocumentType {
  // Universal
  INTERNATIONAL_PASSPORT = "international_passport",
  NATIONAL_ID = "national_id",
  DRIVERS_LICENSE = "drivers_license",
  // Nigeria
  VOTERS_CARD = "voters_card",
  NIN_SLIP = "nin_slip",
  // Ghana
  GHANA_CARD = "ghana_card",
  VOTERS_ID_GHANA = "voters_id_ghana",
  SSNIT_CARD = "ssnit_card",
  // Kenya
  ALIEN_CARD = "alien_card",
  // South Africa
  SA_SMART_ID = "sa_smart_id",
  SA_GREEN_ID_BOOK = "sa_green_id_book",
  REFUGEE_ID = "refugee_id",
  // East/West Africa
  VOTERS_CARD_GENERIC = "voters_card_generic",
  RESIDENCE_PERMIT = "residence_permit",
}

export interface KycDocumentConfig {
  label: string;
  requiresBothSides: boolean;
}

export interface KycCountryConfig {
  countryName: string;
  documents: Partial<Record<KycDocumentType, KycDocumentConfig>>;
}

const GENERIC_DOCS: Partial<Record<KycDocumentType, KycDocumentConfig>> = {
  [KycDocumentType.INTERNATIONAL_PASSPORT]: { label: "International Passport", requiresBothSides: false },
  [KycDocumentType.NATIONAL_ID]: { label: "National ID Card", requiresBothSides: true },
  [KycDocumentType.DRIVERS_LICENSE]: { label: "Driver's License", requiresBothSides: true },
};

export const KycCountryDocumentMap: Record<string, KycCountryConfig> = {
  NG: {
    countryName: "Nigeria",
    documents: {
      [KycDocumentType.INTERNATIONAL_PASSPORT]: { label: "International Passport", requiresBothSides: false },
      [KycDocumentType.NATIONAL_ID]: { label: "National Identity Card", requiresBothSides: true },
      [KycDocumentType.DRIVERS_LICENSE]: { label: "Driver's License", requiresBothSides: true },
      [KycDocumentType.VOTERS_CARD]: { label: "Voter's Card (PVC)", requiresBothSides: true },
      [KycDocumentType.NIN_SLIP]: { label: "NIN Slip", requiresBothSides: false },
    },
  },
  GH: {
    countryName: "Ghana",
    documents: {
      [KycDocumentType.INTERNATIONAL_PASSPORT]: { label: "International Passport", requiresBothSides: false },
      [KycDocumentType.GHANA_CARD]: { label: "Ghana Card (National ID)", requiresBothSides: true },
      [KycDocumentType.VOTERS_ID_GHANA]: { label: "Voter's ID Card", requiresBothSides: true },
      [KycDocumentType.DRIVERS_LICENSE]: { label: "Driver's License", requiresBothSides: true },
      [KycDocumentType.SSNIT_CARD]: { label: "SSNIT Card", requiresBothSides: true },
    },
  },
  KE: {
    countryName: "Kenya",
    documents: {
      [KycDocumentType.INTERNATIONAL_PASSPORT]: { label: "International Passport", requiresBothSides: false },
      [KycDocumentType.NATIONAL_ID]: { label: "National ID Card", requiresBothSides: true },
      [KycDocumentType.DRIVERS_LICENSE]: { label: "Driver's License", requiresBothSides: true },
      [KycDocumentType.ALIEN_CARD]: { label: "Alien Card", requiresBothSides: true },
    },
  },
  ZA: {
    countryName: "South Africa",
    documents: {
      [KycDocumentType.INTERNATIONAL_PASSPORT]: { label: "International Passport", requiresBothSides: false },
      [KycDocumentType.SA_SMART_ID]: { label: "SA Smart ID Card", requiresBothSides: true },
      [KycDocumentType.SA_GREEN_ID_BOOK]: { label: "SA Green ID Book", requiresBothSides: false },
      [KycDocumentType.DRIVERS_LICENSE]: { label: "Driver's License", requiresBothSides: true },
      [KycDocumentType.REFUGEE_ID]: { label: "Refugee ID", requiresBothSides: true },
    },
  },
  TZ: {
    countryName: "Tanzania",
    documents: {
      ...GENERIC_DOCS,
      [KycDocumentType.VOTERS_CARD_GENERIC]: { label: "Voter's Card", requiresBothSides: true },
    },
  },
  UG: {
    countryName: "Uganda",
    documents: {
      ...GENERIC_DOCS,
      [KycDocumentType.VOTERS_CARD_GENERIC]: { label: "Voter's Card", requiresBothSides: true },
    },
  },
  ET: { countryName: "Ethiopia", documents: { ...GENERIC_DOCS } },
  EG: { countryName: "Egypt", documents: { ...GENERIC_DOCS } },
  MA: { countryName: "Morocco", documents: { ...GENERIC_DOCS } },
  SN: { countryName: "Senegal", documents: { ...GENERIC_DOCS } },
  CI: { countryName: "Côte d'Ivoire", documents: { ...GENERIC_DOCS } },
  CM: { countryName: "Cameroon", documents: { ...GENERIC_DOCS } },
  RW: { countryName: "Rwanda", documents: { ...GENERIC_DOCS } },
  ZM: { countryName: "Zambia", documents: { ...GENERIC_DOCS } },
  ZW: { countryName: "Zimbabwe", documents: { ...GENERIC_DOCS } },
  AO: { countryName: "Angola", documents: { ...GENERIC_DOCS } },
  TN: { countryName: "Tunisia", documents: { ...GENERIC_DOCS } },
  BJ: { countryName: "Benin", documents: { ...GENERIC_DOCS } },
  BF: { countryName: "Burkina Faso", documents: { ...GENERIC_DOCS } },
  ML: { countryName: "Mali", documents: { ...GENERIC_DOCS } },
  MZ: { countryName: "Mozambique", documents: { ...GENERIC_DOCS } },
  MG: { countryName: "Madagascar", documents: { ...GENERIC_DOCS } },
  GB: { countryName: "United Kingdom", documents: { ...GENERIC_DOCS } },
  US: { countryName: "United States", documents: { ...GENERIC_DOCS } },
  CA: { countryName: "Canada", documents: { ...GENERIC_DOCS } },
  DE: { countryName: "Germany", documents: { ...GENERIC_DOCS } },
  FR: { countryName: "France", documents: { ...GENERIC_DOCS } },
};
