import '../models/tenant.dart';

// All tenant config must now be loaded from the API.
// This class provides minimal fallback methods for compatibility.

class TenantConfigurations {
  /// Get default tenant configuration (fallback only)
  static TenantConfig getDefaultTenant() {
    return TenantConfig(
      id: 'default',
      name: 'pup',
      displayName: 'pup',
      tenantId: 'default',
      status: 'active',
      domain: 'pup.com',
      logo: '',
      favicon: '',
      contact: ContactInfo(
        email: 'support@pup.com',
        phone: '+2349039517526',
      ),
      branding: BrandingInfo(
        logoUrl: '',
        faviconUrl: '',
        primary_color: '#00695C',
        secondary_color: '#4CAF50',
        domain: 'pup.com',
      ),
      featureFlags: [],
      features: TenantFeatures(),
    );
  }

  /// Get tenant by ID (returns null - use API instead)
  static TenantConfig? getTenantById(String tenantId) {
    // Always return null - tenant configs should be loaded from API
    return null;
  }

  /// Get tenant by domain (returns null - use API instead)
  static TenantConfig? getTenantByDomain(String domain) {
    // Always return null - tenant configs should be loaded from API
    return null;
  }

  /// Get available tenant IDs (returns empty list - use API instead)
  static List<String> getAvailableTenants() {
    // Always return empty - tenant configs should be loaded from API
    return [];
  }
}
