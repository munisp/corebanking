import type { FeatureFlag, TenantData } from '../models/tenant';

/**
 * Utility functions for working with tenant data
 */

// ...existing code...

/**
 * Get feature flag by name from tenant data
 */
export const getFeatureFlagByName = (
  tenantData: TenantData,
  featureName: string
): FeatureFlag | undefined => {
  return tenantData.feature_flags.find(flag => flag.name === featureName);
};

/**
 * Check if a feature is enabled in tenant data
 */
export const isFeatureEnabledInData = (tenantData: TenantData, featureName: string): boolean => {
  const feature = getFeatureFlagByName(tenantData, featureName);
  return feature?.is_enabled ?? false;
};

/**
 * Get all enabled features from tenant data
 */
export const getEnabledFeatures = (tenantData: TenantData): string[] => {
  return tenantData.feature_flags.filter(flag => flag.is_enabled).map(flag => flag.name);
};

/**
 * Get all disabled features from tenant data
 */
export const getDisabledFeatures = (tenantData: TenantData): string[] => {
  return tenantData.feature_flags.filter(flag => !flag.is_enabled).map(flag => flag.name);
};

/**
 * Get feature config by feature name
 */
export const getFeatureConfigByName = (
  tenantData: TenantData,
  featureName: string
): Record<string, any> | undefined => {
  const feature = getFeatureFlagByName(tenantData, featureName);
  return feature?.config;
};

/**
 * Normalize color values (handles cases where colors might not have # prefix)
 */
export const normalizeColor = (color: string): string => {
  if (!color) return '#000000';
  return color.startsWith('#') ? color : `#${color}`;
};

/**
 * Validate hex color
 */
export const isValidHexColor = (color: string): boolean => {
  return /^#[0-9A-F]{6}$/i.test(color) || /^#[0-9A-F]{3}$/i.test(color);
};

/**
 * Get safe color (returns default if invalid)
 */
export const getSafeColor = (color: string | undefined, defaultColor: string): string => {
  if (!color) return defaultColor;
  const normalized = normalizeColor(color);
  return isValidHexColor(normalized) ? normalized : defaultColor;
};
