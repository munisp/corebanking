import { useTenant } from '../contexts/TenantContext';
import { type TenantConfig } from '../models/tenant';
import { toLowerCase, toSnakeCase, toCamelCase } from '../utils/textCaseUtils';

/**
 * Hook to easily access tenant configuration and utilities
 */
export const useTenantConfig = () => {
  const { tenant, setTenant, loadTenant, isLoading, error } = useTenant();

  /**
   * Check if a feature is enabled
   * Supports both snake_case and camelCase feature names
   * Returns false if the feature is not found in feature_flags (hide unknown features)
   */
  const isFeatureEnabled = (feature: string): boolean => {
    // Try direct lookup first (handles enableLPO, loans, etc.)
    if (tenant.feature_flags[feature] === true) {
      return true;
    }

    // Handle legacy "enable*" format - convert to snake_case
    if (feature.startsWith('enable')) {
      // enableCards -> cards, enableLPO -> lpo
      // Use textCaseUtils for normalization
      const normalizedFeature = toLowerCase(feature.replace(/^enable/, ''));
      // Also try with underscores: enableCarbonCredits -> carbon_credits
      const withUnderscores = toSnakeCase(feature.replace(/^enable/, ''));

      if (tenant.feature_flags[normalizedFeature] === true) {
        return true;
      }
      if (tenant.feature_flags[withUnderscores] === true) {
        return true;
      }
      // Try camelCase version of the normalized feature
      const camelCase = toCamelCase(normalizedFeature);
      if (tenant.feature_flags[camelCase] === true) {
        return true;
      }
    }

    // Try camelCase version
    const camelCase2 = toCamelCase(feature);
    if (tenant.feature_flags[camelCase2] === true) {
      return true;
    }

    // Try snake_case version
    const snakeCase = toSnakeCase(feature);
    if (tenant.feature_flags[snakeCase] === true) {
      return true;
    }

    // Feature not found or not enabled - return false
    return false;
  };

  /**
   * Get feature configuration
   */
  const getFeatureConfig = (feature: string): Record<string, unknown> | undefined => {
    const configKey = `${feature}Config`;
    const config = tenant.feature_flags[configKey];
    if (typeof config === 'object' && config !== null) {
      return config as Record<string, unknown>;
    }
    return undefined;
  };

  /**
   * Get brand color from tenant branding
   */
  const getBrandColor = (colorKey: keyof TenantConfig['branding']): string => {
    return tenant.branding[colorKey] as string;
  };

  /**
   * Get contact information
   */
  const getContactInfo = () => {
    return tenant.contact;
  };

  /**
   * Check if tenant is active
   */
  const isTenantActive = (): boolean => {
    return tenant.status === 'active';
  };

  /**
   * Get auth realm from auth feature config
   */
  const getAuthRealm = (): string | undefined => {
    const authConfig = getFeatureConfig('auth');
    if (authConfig && typeof authConfig.realm === 'string') {
      return authConfig.realm;
    }
    return undefined;
  };

  /**
   * Get auth public key
   */
  const getAuthPublicKey = (): string | undefined => {
    const authConfig = getFeatureConfig('auth');
    if (authConfig && typeof authConfig.public_rsa_key === 'string') {
      return authConfig.public_rsa_key;
    }
    return undefined;
  };

  /**
   * Get accounts configuration
   */
  const getAccountsConfig = (): Record<string, unknown> | undefined => {
    const accountsConfig = getFeatureConfig('accounts');
    if (accountsConfig && typeof accountsConfig.account === 'object' && accountsConfig.account !== null) {
      return accountsConfig.account as Record<string, unknown>;
    }
    return undefined;
  };

  /**
   * Refresh tenant configuration from server
   */
  const refreshTenant = async () => {
    if (tenant.id) {
      await loadTenant(tenant.id);
    }
  };

  return {
    tenant,
    setTenant,
    loadTenant,
    refreshTenant,
    isLoading,
    error,
    isFeatureEnabled,
    getFeatureConfig,
    getBrandColor,
    getContactInfo,
    isTenantActive,
    getAuthRealm,
    getAuthPublicKey,
    getAccountsConfig,
  };
};
