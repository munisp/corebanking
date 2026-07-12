import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/tenant_provider.dart';
import '../models/tenant.dart';

/// Hook-like class for easily accessing tenant configuration
/// Similar to React's useTenantConfig hook in the web app
class TenantConfigHelper {
  final BuildContext context;
  late final TenantProvider _provider;

  TenantConfigHelper(this.context, {bool listen = true}) {
    _provider = Provider.of<TenantProvider>(context, listen: listen);
  }

  /// Get the current tenant configuration
  TenantConfig get tenant => _provider.tenantConfig;

  /// Get tenant loading state
  bool get isLoading => _provider.isLoading;

  /// Get tenant error message
  String? get error => _provider.errorMessage;

  /// Check if a feature is enabled
  bool isFeatureEnabled(String feature) {
    return _provider.isFeatureEnabled(feature);
  }

  /// Get feature configuration
  Map<String, dynamic>? getFeatureConfig(String feature) {
    return _provider.getFeatureConfig(feature);
  }

  /// Get brand color
  Color getBrandColor(String colorKey) {
    return _provider.getBrandColor(colorKey);
  }

  /// Get contact information
  ContactInfo get contactInfo => _provider.contactInfo;

  /// Check if tenant is active
  bool get isTenantActive => _provider.isTenantActive;

  /// Get auth realm
  String? getAuthRealm() => _provider.getAuthRealm();

  /// Get auth public key
  String? getAuthPublicKey() => _provider.getAuthPublicKey();

  /// Get accounts configuration
  Map<String, dynamic>? getAccountsConfig() => _provider.getAccountsConfig();

  /// Refresh tenant configuration
  Future<void> refreshTenant() => _provider.refreshTenant();

  /// Switch to a different tenant
  Future<void> switchTenant(String tenantId) => _provider.switchTenant(tenantId);

  /// Set tenant configuration
  Future<void> setTenant(TenantConfig config) => _provider.setTenant(config);

  // Convenience color getters
  Color get primaryColor => _provider.primaryColor;
  Color get secondaryColor => _provider.secondaryColor;
  Color get accentColor => _provider.accentColor;
  Color get errorColor => _provider.errorColor;
  Color get warningColor => _provider.warningColor;
  Color get successColor => _provider.successColor;
  Color get backgroundColor => _provider.backgroundColor;
  Color get surfaceColor => _provider.surfaceColor;
  Color get textPrimaryColor => _provider.textPrimaryColor;
  Color get textSecondaryColor => _provider.textSecondaryColor;

  // Convenience info getters
  String get appName => _provider.appName;
  String get logoUrl => _provider.logoUrl;
  String get supportEmail => _provider.supportEmail;
  String get supportPhone => _provider.supportPhone;
  String? get supportUrl => _provider.supportUrl;
  String? get address => _provider.address;
  SocialMedia? get socialMedia => _provider.socialMedia;
  double get borderRadius => _provider.borderRadius;
  String get fontFamily => _provider.fontFamily;
}

/// Widget that provides tenant configuration to its descendants
/// Similar to React Context in the web app
class TenantConfigProvider extends StatelessWidget {
  final Widget child;

  const TenantConfigProvider({
    super.key,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<TenantProvider>(
      builder: (context, tenantProvider, _) {
        return child;
      },
    );
  }
}

/// Mixin to add tenant configuration access to StatefulWidget
mixin TenantConfigMixin<T extends StatefulWidget> on State<T> {
  TenantProvider get tenantProvider => Provider.of<TenantProvider>(context);
  TenantConfig get tenantConfig => tenantProvider.tenantConfig;

  bool isFeatureEnabled(String feature) {
    return tenantProvider.isFeatureEnabled(feature);
  }

  Color get primaryColor => tenantProvider.primaryColor;
  Color get secondaryColor => tenantProvider.secondaryColor;
}

/// Extension on BuildContext for easy tenant config access
extension TenantConfigContext on BuildContext {
  /// Get tenant configuration helper
  TenantConfigHelper get tenantConfig => TenantConfigHelper(this);

  /// Get tenant configuration helper without listening
  TenantConfigHelper get tenantConfigOnce => TenantConfigHelper(this, listen: false);

  /// Quick access to tenant provider
  TenantProvider get tenantProvider => Provider.of<TenantProvider>(this);

  /// Quick access to tenant provider without listening
  TenantProvider get tenantProviderOnce => Provider.of<TenantProvider>(this, listen: false);
}

/// Example usage of the tenant config helper
class TenantConfigHelperExample extends StatelessWidget {
  const TenantConfigHelperExample({super.key});

  @override
  Widget build(BuildContext context) {
    // Method 1: Using the helper directly
    final tenantConfig = TenantConfigHelper(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(tenantConfig.appName),
        backgroundColor: tenantConfig.primaryColor,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Using helper methods
            Text(
              'Welcome to ${tenantConfig.appName}',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: tenantConfig.primaryColor,
              ),
            ),
            const SizedBox(height: 16),

            // Check features
            if (tenantConfig.isFeatureEnabled('loans'))
              _buildFeatureCard(
                context,
                'Loans',
                'Apply for a loan',
                Icons.account_balance,
                tenantConfig.primaryColor,
              ),

            if (tenantConfig.isFeatureEnabled('insurance'))
              _buildFeatureCard(
                context,
                'Insurance',
                'Get insurance coverage',
                Icons.security,
                tenantConfig.secondaryColor,
              ),

            const SizedBox(height: 24),

            // Contact information
            Text(
              'Contact Us',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: tenantConfig.textPrimaryColor,
              ),
            ),
            const SizedBox(height: 8),
            ListTile(
              leading: Icon(Icons.email, color: tenantConfig.primaryColor),
              title: Text(tenantConfig.supportEmail),
              subtitle: const Text('Email'),
            ),
            ListTile(
              leading: Icon(Icons.phone, color: tenantConfig.primaryColor),
              title: Text(tenantConfig.supportPhone),
              subtitle: const Text('Phone'),
            ),

            const SizedBox(height: 24),

            // Branded button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: tenantConfig.primaryColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(tenantConfig.borderRadius),
                  ),
                ),
                onPressed: () {},
                child: const Text('Get Started'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureCard(
    BuildContext context,
    String title,
    String subtitle,
    IconData icon,
    Color color,
  ) {
    // Method 2: Using context extension
    final config = context.tenantConfig;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(config.borderRadius),
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withOpacity(0.1),
          child: Icon(icon, color: color),
        ),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: Icon(Icons.arrow_forward_ios, size: 16, color: color),
        onTap: () {},
      ),
    );
  }
}

/// Example using the mixin
class MixinExample extends StatefulWidget {
  const MixinExample({super.key});

  @override
  State<MixinExample> createState() => _MixinExampleState();
}

class _MixinExampleState extends State<MixinExample> with TenantConfigMixin {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tenantConfig.displayName),
        backgroundColor: primaryColor, // From mixin
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'Using Mixin',
              style: TextStyle(
                fontSize: 24,
                color: primaryColor, // From mixin
              ),
            ),
            const SizedBox(height: 16),
            if (isFeatureEnabled('payments')) // From mixin
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: secondaryColor, // From mixin
                ),
                onPressed: () {},
                child: const Text('Make Payment'),
              ),
          ],
        ),
      ),
    );
  }
}
