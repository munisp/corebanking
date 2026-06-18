import '../utils/text_case_utils.dart';
import 'package:flutter/material.dart';
import '../models/tenant.dart';
import '../config/tenant_configs.dart';
import '../services/tenant_service.dart';
import '../config/app_config.dart';

class TenantProvider extends ChangeNotifier {
  TenantConfig _tenantConfig = TenantConfigurations.getDefaultTenant();
  bool _isLoading = false;
  String? _errorMessage;

  TenantProvider();

  TenantConfig get tenantConfig => _tenantConfig;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  /// Initialize tenant configuration
  /// Matches web app priority: URL -> localStorage -> default
  /// For mobile, we use: stored tenant_id -> default
  Future<void> initialize() async {
    await _initializeTenant();
  }

  /// Initialize tenant with priority matching web app
  Future<void> _initializeTenant() async {
    try {
      // Priority 1: Check stored tenant_id (mobile equivalent of URL params)
      final savedTenantId = await TenantService.getTenantId();
      final savedTenantConfig = await TenantService.loadTenantConfig();

      // Priority 2: Use environment variable default or fallback to 'pup'
      final defaultTenantId = AppConfig.CURRENT_TENANT_ID.isNotEmpty 
          ? AppConfig.CURRENT_TENANT_ID 
          : 'pup';
      final tenantId = savedTenantId ?? defaultTenantId;

      // Always fetch from API to ensure we have the latest config (matching web app)
      if (savedTenantConfig == null) {
        // No cached config, fetch from API
        debugPrint('Loading tenant configuration for: $tenantId');
        await loadTenant(tenantId);
      } else {
        // Have cached config - use it immediately but refresh in background
        debugPrint('Using cached tenant configuration for: $savedTenantId');
        _tenantConfig = savedTenantConfig;
        notifyListeners();
        
        // Always refresh in background to keep config up-to-date (matching web app)
        if (savedTenantId != null) {
          loadTenant(savedTenantId).catchError((err) {
            debugPrint('Background tenant refresh failed: $err');
          });
        }
      }
    } catch (error) {
      debugPrint('Failed to initialize tenant: $error');
      // Continue with default tenant on error
      await loadStoredTenant();
    }
  }

  /// Load tenant configuration from API
  /// Matches web app: uses TenantService.fetchTenantConfig
  Future<void> loadTenant(String tenantId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // Fetch tenant config from API using TenantService (matching web app)
      final tenantConfig = await TenantService.fetchTenantConfig(tenantId);
      
      // Validate tenant config (matching web app)
      if (!TenantService.validateTenantConfig(tenantConfig)) {
        throw Exception('Invalid tenant configuration');
      }
      
      _tenantConfig = tenantConfig;
      
      // Save tenant config (matching web app - TenantService.saveTenantConfig)
      await TenantService.saveTenantConfig(tenantConfig);
      
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      debugPrint('Error loading tenant config: $e');
      
      // Fall back to default tenant on error (matching web app)
      await loadStoredTenant();
      notifyListeners();
    }
  }

  /// Load tenant from storage
  /// Matches web app: TenantService.loadTenantConfig()
  Future<void> loadStoredTenant() async {
    try {
      final storedConfig = await TenantService.loadTenantConfig();
      
      if (storedConfig != null) {
        _tenantConfig = storedConfig;
      } else {
        // Use default tenant (matching web app DEFAULT_TENANT)
        _tenantConfig = TenantConfigurations.getDefaultTenant();
      }
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading stored tenant: $e');
      _tenantConfig = TenantConfigurations.getDefaultTenant();
      notifyListeners();
    }
  }

  /// Set tenant configuration manually
  /// Matches web app: TenantService.saveTenantConfig
  Future<void> setTenant(TenantConfig config) async {
    _tenantConfig = config;
    await TenantService.saveTenantConfig(config);
    notifyListeners();
  }

  /// Switch to a different tenant by ID
  /// Matches web app: loadTenant(tenantId)
  Future<void> switchTenant(String tenantId) async {
    await loadTenant(tenantId);
  }

  /// Refresh current tenant configuration from server
  /// Matches web app: loadTenant with current tenant ID
  Future<void> refreshTenant() async {
    final tenantId = await TenantService.getTenantId() ?? _tenantConfig.id;
    await loadTenant(tenantId);
  }

  /// Check if a feature is enabled
  bool isFeatureEnabled(String featureName) {
    return _tenantConfig.isFeatureEnabled(featureName);
  }

  /// Get feature configuration
  Map<String, dynamic>? getFeatureConfig(String featureName) {
    return _tenantConfig.getFeatureConfig(featureName);
  }

  /// Get brand color by key
  Color getBrandColor(String colorKey) {
    String? colorString;
    
    switch (toLowerCase(colorKey)) {
      case 'primary':
      case 'primarycolor':
        colorString = _tenantConfig.branding.primary_color;
        break;
      case 'secondary':
      case 'secondarycolor':
        colorString = _tenantConfig.branding.secondary_color;
        break;
      case 'accent':
      case 'accentcolor':
        colorString = _tenantConfig.branding.accentColor;
        break;
      case 'error':
      case 'errorcolor':
        colorString = _tenantConfig.branding.errorColor;
        break;
      case 'warning':
      case 'warningcolor':
        colorString = _tenantConfig.branding.warningColor;
        break;
      case 'success':
      case 'successcolor':
        colorString = _tenantConfig.branding.successColor;
        break;
      case 'background':
      case 'backgroundcolor':
        colorString = _tenantConfig.branding.backgroundColor;
        break;
      case 'surface':
      case 'surfacecolor':
        colorString = _tenantConfig.branding.surfaceColor;
        break;
      case 'textprimary':
      case 'textprimarycolor':
        colorString = _tenantConfig.branding.textPrimaryColor;
        break;
      case 'textsecondary':
      case 'textsecondarycolor':
        colorString = _tenantConfig.branding.textSecondaryColor;
        break;
    }

    return _parseColor(colorString ?? _tenantConfig.branding.primary_color);
  }

  /// Parse color string to Color object
  Color _parseColor(String colorString) {
    if (colorString.startsWith('#')) {
      final hexColor = colorString.substring(1);
      try {
        return Color(int.parse(hexColor, radix: 16) + 0xFF000000);
      } catch (e) {
        return const Color(0xFF1A73E8); // Default color
      }
    }
    
    // Handle named colors
    final colorName = toLowerCase(colorString).trim();
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
        try {
          return Color(int.parse(colorString, radix: 16) + 0xFF000000);
        } catch (e) {
          return const Color(0xFF1A73E8); // Default color
        }
    }
  }

  // Convenience getters
  Color get primaryColor => getBrandColor('primary');
  Color get secondaryColor => getBrandColor('secondary');
  Color get accentColor => getBrandColor('accent');
  Color get errorColor => getBrandColor('error');
  Color get warningColor => getBrandColor('warning');
  Color get successColor => getBrandColor('success');
  Color get backgroundColor => getBrandColor('background');
  Color get surfaceColor => getBrandColor('surface');
  Color get textPrimaryColor => getBrandColor('textPrimary');
  Color get textSecondaryColor => getBrandColor('textSecondary');

  String get appName => _tenantConfig.displayName;
  String get logoUrl => _tenantConfig.branding.logoUrl;
  String get supportEmail => _tenantConfig.contact.email;
  String get supportPhone => _tenantConfig.contact.phone;
  String? get supportUrl => _tenantConfig.contact.supportUrl;
  String? get address => _tenantConfig.contact.address;
  SocialMedia? get socialMedia => _tenantConfig.contact.socialMedia;
  
  double get borderRadius => _tenantConfig.branding.borderRadius;
  String get fontFamily => _tenantConfig.branding.fontFamily;
  
  bool get isTenantActive => _tenantConfig.isTenantActive;
  
  /// Get contact information
  ContactInfo get contactInfo => _tenantConfig.contact;
  
  /// Get auth realm from auth feature config
  String? getAuthRealm() {
    final authConfig = getFeatureConfig('auth');
    return authConfig?['realm'] as String?;
  }
  
  /// Get auth public key
  String? getAuthPublicKey() {
    final authConfig = getFeatureConfig('auth');
    return authConfig?['public_rsa_key'] as String?;
  }
  
  /// Get accounts configuration
  Map<String, dynamic>? getAccountsConfig() {
    final accountsConfig = getFeatureConfig('accounts');
    return accountsConfig?['account'] as Map<String, dynamic>?;
  }
}
