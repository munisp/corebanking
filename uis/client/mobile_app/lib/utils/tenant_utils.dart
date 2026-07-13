import 'package:flutter/material.dart';
import '../models/tenant.dart';
import '../config/tenant_configs.dart';

/// Utility class for tenant-related helper functions
class TenantUtils {
  /// Get tenant by ID
  static TenantConfig? getTenantById(String tenantId) {
    return TenantConfigurations.getTenantById(tenantId);
  }

  /// Get tenant by domain
  static TenantConfig? getTenantByDomain(String domain) {
    return TenantConfigurations.getTenantByDomain(domain);
  }

  /// Get all available tenant IDs
  static List<String> getAvailableTenants() {
    return TenantConfigurations.getAvailableTenants();
  }

  /// Get default tenant
  static TenantConfig getDefaultTenant() {
    return TenantConfigurations.getDefaultTenant();
  }

  /// Parse hex color string to Color
  static Color parseColor(String colorString, {Color? fallback}) {
    try {
      if (colorString.startsWith('#')) {
        final hexColor = colorString.substring(1);
        return Color(int.parse(hexColor, radix: 16) + 0xFF000000);
      }
      
      // Handle named colors
      final colorName = colorString.toLowerCase().trim();
      switch (colorName) {
        case 'red':
          return Colors.red;
        case 'green':
          return Colors.green;
        case 'blue':
          return Colors.blue;
        case 'yellow':
          return Colors.yellow;
        case 'orange':
          return Colors.orange;
        case 'purple':
          return Colors.purple;
        case 'pink':
          return Colors.pink;
        case 'teal':
          return Colors.teal;
        case 'cyan':
          return Colors.cyan;
        case 'amber':
          return Colors.amber;
        case 'indigo':
          return Colors.indigo;
        case 'brown':
          return Colors.brown;
        case 'grey':
        case 'gray':
          return Colors.grey;
        case 'black':
          return Colors.black;
        case 'white':
          return Colors.white;
        default:
          // Try parsing as hex without #
          return Color(int.parse(colorString, radix: 16) + 0xFF000000);
      }
    } catch (e) {
      return fallback ?? const Color(0xFF1A73E8);
    }
  }

  /// Convert Color to hex string
  static String colorToHex(Color color) {
    return '#${color.value.toRadixString(16).substring(2).toUpperCase()}';
  }

  /// Create a lighter shade of a color
  static Color lightenColor(Color color, [double amount = 0.1]) {
    assert(amount >= 0 && amount <= 1);
    final hsl = HSLColor.fromColor(color);
    final lightness = (hsl.lightness + amount).clamp(0.0, 1.0);
    return hsl.withLightness(lightness).toColor();
  }

  /// Create a darker shade of a color
  static Color darkenColor(Color color, [double amount = 0.1]) {
    assert(amount >= 0 && amount <= 1);
    final hsl = HSLColor.fromColor(color);
    final lightness = (hsl.lightness - amount).clamp(0.0, 1.0);
    return hsl.withLightness(lightness).toColor();
  }

  /// Get contrasting text color (black or white) based on background
  static Color getContrastingTextColor(Color backgroundColor) {
    // Calculate relative luminance
    final luminance = backgroundColor.computeLuminance();
    // Return white for dark backgrounds, black for light backgrounds
    return luminance > 0.5 ? Colors.black : Colors.white;
  }

  /// Transform server response to client-side TenantConfig
  static TenantConfig transformTenantData(Map<String, dynamic> serverData) {
    // Transform feature flags array to features
    final featureFlags = (serverData['feature_flags'] as List<dynamic>?)
        ?.map((flag) => FeatureFlag.fromJson(flag as Map<String, dynamic>))
        .toList() ?? [];

    final features = TenantFeatures.fromFeatureFlags(featureFlags);
    final branding = BrandingInfo.fromJson(serverData['branding'] as Map<String, dynamic>);

    return TenantConfig(
      id: serverData['tenant_id'] as String,
      name: serverData['name'] as String,
      displayName: serverData['name'] as String,
      tenantId: serverData['tenant_id'] as String,
      domain: branding.domain,
      logo: branding.logoUrl,
      favicon: branding.faviconUrl,
      status: serverData['status'] as String,
      branding: branding,
      features: features,
      contact: ContactInfo.fromJson(serverData['contact'] as Map<String, dynamic>),
      featureFlags: featureFlags,
      metadata: TenantMetadata(
        createdAt: DateTime.parse(serverData['created_at'] as String),
        updatedAt: DateTime.parse(serverData['updated_at'] as String),
        deletedAt: serverData['deleted_at'] != null
            ? DateTime.parse(serverData['deleted_at'] as String)
            : null,
      ),
    );
  }

  /// Validate tenant configuration
  static bool validateTenantConfig(TenantConfig config) {
    if (config.id.isEmpty) return false;
    if (config.name.isEmpty) return false;
    if (config.domain.isEmpty) return false;
    if (config.contact.email.isEmpty) return false;
    if (config.contact.phone.isEmpty) return false;
    return true;
  }

  /// Get feature display name
  static String getFeatureDisplayName(String featureName) {
    final displayNames = {
      'payments': 'Payments',
      'loans': 'Loans',
      'insurance': 'Insurance',
      'auth': 'Authentication',
      'userManagement': 'User Management',
      'user_management': 'User Management',
      'accounts': 'Accounts',
      'reporting': 'Reporting',
      'enableBiometrics': 'Biometric Authentication',
      'enable_biometrics': 'Biometric Authentication',
      'enableQRPayments': 'QR Payments',
      'enable_qr_payments': 'QR Payments',
      'enablePushNotifications': 'Push Notifications',
      'enable_push_notifications': 'Push Notifications',
      'enableLPO': 'Local Purchase Orders',
      'enable_lpo': 'Local Purchase Orders',
      'enableCarbonCredits': 'Carbon Credits',
      'enable_carbon_credits': 'Carbon Credits',
      'enableCards': 'Cards',
      'enable_cards': 'Cards',
      'enableBillPayments': 'Bill Payments',
      'enable_bill_payments': 'Bill Payments',
      'enableRewards': 'Rewards',
      'enable_rewards': 'Rewards',
    };

    return displayNames[featureName] ?? _formatFeatureName(featureName);
  }

  /// Format feature name to readable text
  static String _formatFeatureName(String featureName) {
    // Remove 'enable' prefix if present
    String formatted = featureName.replaceFirst(RegExp(r'^enable'), '');
    
    // Convert camelCase to space-separated
    formatted = formatted.replaceAllMapped(
      RegExp(r'([A-Z])'),
      (match) => ' ${match.group(1)}',
    ).trim();
    
    // Convert snake_case to space-separated
    formatted = formatted.replaceAll('_', ' ');
    
    // Capitalize first letter of each word
    return formatted.split(' ').map((word) {
      if (word.isEmpty) return word;
      return word[0].toUpperCase() + word.substring(1).toLowerCase();
    }).join(' ');
  }
}

/// Extension methods for TenantConfig
extension TenantConfigExtensions on TenantConfig {
  /// Get a color from branding by key
  Color getColor(String colorKey) {
    return TenantUtils.parseColor(
      colorKey == 'primary' ? branding.primary_color :
      colorKey == 'secondary' ? branding.secondary_color :
      colorKey == 'accent' ? (branding.accentColor ?? branding.secondary_color) :
      colorKey == 'error' ? (branding.errorColor ?? '#D32F2F') :
      colorKey == 'warning' ? (branding.warningColor ?? '#FFA726') :
      colorKey == 'success' ? (branding.successColor ?? '#66BB6A') :
      colorKey == 'background' ? branding.backgroundColor :
      colorKey == 'surface' ? branding.surfaceColor :
      colorKey == 'textPrimary' ? branding.textPrimaryColor :
      colorKey == 'textSecondary' ? branding.textSecondaryColor :
      branding.primary_color,
    );
  }

  /// Check if tenant has social media links
  bool hasSocialMedia() {
    return contact.socialMedia != null &&
        (contact.socialMedia!.facebook != null ||
         contact.socialMedia!.twitter != null ||
         contact.socialMedia!.instagram != null ||
         contact.socialMedia!.linkedin != null);
  }

  /// Get list of enabled features
  List<String> getEnabledFeatures() {
    final enabled = <String>[];
    final featuresMap = features.toJson();
    
    featuresMap.forEach((key, value) {
      if (value is bool && value == true) {
        enabled.add(key);
      }
    });
    
    return enabled;
  }

  /// Get count of enabled features
  int getEnabledFeaturesCount() {
    return getEnabledFeatures().length;
  }
}
