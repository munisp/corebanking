/**
 * Bank Onboarding Types and Interfaces
 * Complete type definitions for bank creation/onboarding payload
 */

/**
 * Subscription Tier Options
 */
export type BankTier = 'Basic' | 'Pro' | 'Enterprise';

/**
 * Available Feature IDs
 */
export type BankFeature = 
  | 'accounts'     // Account Management (Included)
  | 'loans'        // Loan Processing (Included)
  | 'cards'        // Card Services (+₦200K/mo)
  | 'mobile'       // Mobile Banking (+₦150K/mo)
  | 'supply'       // Supply Chain Finance (+₦400K/mo)
  | 'islamic';     // Islamic Banking (+₦350K/mo)

/**
 * Complete Bank Onboarding Payload
 * Use this interface for the API request body
 */
export interface BankOnboardingPayload {
  // Step 1: Bank Information
  bankName: string;
  bankCode: string;
  tier: BankTier;
  contactEmail: string;
  contactPhone: string;
  
  // Step 2: Documents (optional, can be File objects or file URLs/IDs)
  cacDocument?: File | string | null;
  cbnLicense?: File | string | null;
  
  // Step 3: API Configuration
  webhookUrl: string;
  callbackUrl: string;
  
  // Step 4: Feature Selection
  features?: BankFeature[];
}

/**
 * Bank Onboarding Request (for JSON requests without file uploads)
 * Use this when sending files separately or as URLs/IDs
 */
export interface BankOnboardingRequest {
  bankName: string;
  bankCode: string;
  tier: BankTier;
  contactEmail: string;
  contactPhone: string;
  cacDocument?: string | null;  // File URL or ID
  cbnLicense?: string | null;   // File URL or ID
  webhookUrl: string;
  callbackUrl: string;
  features?: BankFeature[];
}

/**
 * Bank Onboarding Form Data (for frontend state)
 * Use this in React components for form state management
 */
export interface BankOnboardingFormData {
  // Step 1: Bank Info
  bankName: string;
  bankCode: string;
  tier: BankTier;
  contactEmail: string;
  contactPhone: string;
  
  // Step 2: Documents
  cacDocument: File | null;
  cbnLicense: File | null;
  
  // Step 3: API
  webhookUrl: string;
  callbackUrl: string;
  
  // Step 4: Features
  features: BankFeature[];
}

/**
 * API Response after successful bank onboarding
 */
export interface BankOnboardingResponse {
  success: boolean;
  message: string;
  data: {
    bankId: string;
    apiKey: string;
    secretKey: string;
    bankName: string;
    bankCode: string;
    tier: BankTier;
    contactEmail: string;
    webhookUrl: string;
    callbackUrl: string;
    features: BankFeature[];
    createdAt: string;
    status: 'active' | 'pending' | 'suspended';
  };
}

/**
 * Tier Pricing Configuration
 */
export interface TierPricing {
  Basic: {
    monthlyFee: number;
    currency: string;
  };
  Pro: {
    monthlyFee: number;
    currency: string;
  };
  Enterprise: {
    monthlyFee: number;
    currency: string;
  };
}

/**
 * Feature Pricing Configuration
 */
export interface FeaturePricing {
  accounts: {
    price: number;
    currency: string;
    included: boolean;
  };
  loans: {
    price: number;
    currency: string;
    included: boolean;
  };
  cards: {
    price: number;
    currency: string;
    included: boolean;
  };
  mobile: {
    price: number;
    currency: string;
    included: boolean;
  };
  supply: {
    price: number;
    currency: string;
    included: boolean;
  };
  islamic: {
    price: number;
    currency: string;
    included: boolean;
  };
}

/**
 * Complete Bank Onboarding Configuration
 * Use this for default values and configuration
 */
export const BANK_ONBOARDING_CONFIG = {
  tiers: ['Basic', 'Pro', 'Enterprise'] as const,
  defaultTier: 'Basic' as BankTier,
  
  tierPricing: {
    Basic: { monthlyFee: 500000, currency: 'NGN' },
    Pro: { monthlyFee: 2000000, currency: 'NGN' },
    Enterprise: { monthlyFee: 5000000, currency: 'NGN' },
  } as TierPricing,
  
  features: [
    { id: 'accounts' as BankFeature, name: 'Account Management', price: 'Included' },
    { id: 'loans' as BankFeature, name: 'Loan Processing', price: 'Included' },
    { id: 'cards' as BankFeature, name: 'Card Services', price: '+₦200K/mo' },
    { id: 'mobile' as BankFeature, name: 'Mobile Banking', price: '+₦150K/mo' },
    { id: 'supply' as BankFeature, name: 'Supply Chain Finance', price: '+₦400K/mo' },
    { id: 'islamic' as BankFeature, name: 'Islamic Banking', price: '+₦350K/mo' },
  ],
  
  featurePricing: {
    accounts: { price: 0, currency: 'NGN', included: true },
    loans: { price: 0, currency: 'NGN', included: true },
    cards: { price: 200000, currency: 'NGN', included: false },
    mobile: { price: 150000, currency: 'NGN', included: false },
    supply: { price: 400000, currency: 'NGN', included: false },
    islamic: { price: 350000, currency: 'NGN', included: false },
  } as FeaturePricing,
} as const;

/**
 * Example Bank Onboarding Payload
 */
export const EXAMPLE_BANK_ONBOARDING_PAYLOAD: BankOnboardingRequest = {
  bankName: 'Wema Bank',
  bankCode: '035',
  tier: 'Enterprise',
  contactEmail: 'admin@wemabank.com',
  contactPhone: '+234 800 000 0000',
  webhookUrl: 'https://api.wemabank.com/webhooks',
  callbackUrl: 'https://api.wemabank.com/callback',
  features: ['accounts', 'loans', 'cards', 'mobile'],
  cacDocument: null,
  cbnLicense: null,
};

/**
 * Type guard to check if a string is a valid BankTier
 */
export function isBankTier(value: string): value is BankTier {
  return BANK_ONBOARDING_CONFIG.tiers.includes(value as BankTier);
}

/**
 * Type guard to check if a string is a valid BankFeature
 */
export function isBankFeature(value: string): value is BankFeature {
  const validFeatures: BankFeature[] = ['accounts', 'loans', 'cards', 'mobile', 'supply', 'islamic'];
  return validFeatures.includes(value as BankFeature);
}







