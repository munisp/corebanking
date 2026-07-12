// src/services/verification_service.ts

export type VerificationType = 'phone' | 'nin' | 'bvn';

export interface VerificationRequest {
  type: VerificationType;
  value: string;
}

export interface VerificationResponse {
  success: boolean;
  message: string;
}

export const verificationService = {
  async verify({ type, value }: VerificationRequest): Promise<VerificationResponse> {
    if (!value) {
      return { success: false, message: 'Value is required' };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (type === 'phone') {
      // Accepts Nigerian numbers: 070xxxxxxxx, 080xxxxxxxx, 090xxxxxxxx, 081xxxxxxxx, 091xxxxxxxx, or +2347/8/9xxxxxxxx
      const phonePattern = /^(\+234|0)(7[0-9]|8[0-9]|9[0-9])[0-9]{8}$/;
      if (!phonePattern.test(value)) {
        return { success: false, message: 'Invalid phone number format' };
      }
      return { success: true, message: 'Phone number verified successfully' };
    }
    if (type === 'nin') {
      if (!/^\d{11}$/.test(value)) {
        return { success: false, message: 'NIN must be exactly 11 digits' };
      }
      return { success: true, message: 'NIN verified successfully' };
    }
    if (type === 'bvn') {
      if (!/^\d{11}$/.test(value)) {
        return { success: false, message: 'BVN must be exactly 11 digits' };
      }
      return { success: true, message: 'BVN verified successfully' };
    }
    return { success: false, message: 'Unknown verification type' };
  },
};
