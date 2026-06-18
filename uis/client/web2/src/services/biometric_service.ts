import { AppConfig } from '../config/app_config';

export class BiometricService {
  // Check if biometric authentication is available (WebAuthn)
  async isBiometricAvailable(): Promise<boolean> {
    try {
      return !!(window.PublicKeyCredential && navigator.credentials);
    } catch {
      return false;
    }
  }

  // Get available biometric types (WebAuthn doesn't expose types reliably)
  async getAvailableBiometrics(): Promise<string[]> {
    const available: string[] = [];
    if (await this.isBiometricAvailable()) {
      // Browsers don't expose exact biometric type; assume generic
      available.push('Biometric');
    }
    return available;
  }

  // Check if device supports biometrics
  async isDeviceSupported(): Promise<boolean> {
    return this.isBiometricAvailable();
  }

  // Authenticate with biometrics using WebAuthn (simplified)
  async authenticate(_localizedReason = 'Please authenticate to access your account'): Promise<boolean> {
    if (!(await this.isBiometricAvailable())) return false;

    try {
      // Dummy credential request (real implementation would use a server challenge)
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          timeout: 60000,
          allowCredentials: [],
          userVerification: 'required',
        },
      });
      return !!credential;
    } catch {
      return false;
    }
  }

  // Check if biometric is enabled for this app
  isEnabled = async (): Promise<boolean> => {
    return localStorage.getItem(AppConfig.biometricEnabledKey) === 'true';
  };

  // Enable biometric
  enable = async (): Promise<void> => {
    localStorage.setItem(AppConfig.biometricEnabledKey, 'true');
  };

  // Disable biometric
  disable = async (): Promise<void> => {
    localStorage.removeItem(AppConfig.biometricEnabledKey);
  };

  isBiometricEnabled(): boolean {
    return localStorage.getItem(AppConfig.biometricEnabledKey) === 'true';
  }

  // Enable biometric authentication
  enableBiometric(): void {
    localStorage.setItem(AppConfig.biometricEnabledKey, 'true');
  }

  // Disable biometric authentication
  disableBiometric(): void {
    localStorage.setItem(AppConfig.biometricEnabledKey, 'false');
  }

  // Get biometric type name
  getBiometricTypeName(biometrics: string[]): string {
    if (biometrics.includes('Face ID')) return 'Face ID';
    if (biometrics.includes('Fingerprint')) return 'Fingerprint';
    if (biometrics.includes('Iris')) return 'Iris';
    if (biometrics.includes('Biometric')) return 'Biometric';
    return 'Biometric';
  }
}

export const biometricService = new BiometricService();
