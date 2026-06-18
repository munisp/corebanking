import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

/// Multi-tenant service that manages:
/// - Tenant context (ID, tier, branding)
/// - Feature gating based on tier/plan
/// - White-label theming (colors, logo, app name)
/// - Data isolation (tenant ID injected into all API calls)
class TenantService extends ChangeNotifier {
  static final TenantService _instance = TenantService._internal();
  factory TenantService() => _instance;
  TenantService._internal();

  String _tenantId = 'platform';
  String _tier = 'starter';
  String _appName = '54Bank';
  Map<String, dynamic> _features = {};
  Map<String, dynamic> _branding = {};
  bool _initialized = false;

  String get tenantId => _tenantId;
  String get tier => _tier;
  String get appName => _appName;
  Map<String, dynamic> get features => _features;
  Map<String, dynamic> get branding => _branding;
  bool get initialized => _initialized;

  /// Available agents for current tier
  List<String> get allowedAgents =>
      List<String>.from(_features['agents'] ?? []);

  /// Available KPI roles for current tier
  List<String> get allowedKpiRoles =>
      List<String>.from(_features['kpi_roles'] ?? []);

  /// Available graph tools for current tier
  List<String> get allowedGraphTools =>
      List<String>.from(_features['graph_tools'] ?? []);

  /// Whether white-label is enabled
  bool get isWhiteLabel => _features['white_label'] == true;

  /// Custom domain support
  bool get hasCustomDomain => _features['custom_domain'] == true;

  /// Max users allowed
  int get maxUsers => _features['max_users'] ?? 50;

  /// API rate limit
  int get apiRateLimit => _features['api_rate_limit'] ?? 100;

  /// Primary color from branding
  Color get primaryColor {
    final hex = _branding['primary_color'] as String? ?? '#1a237e';
    return _parseColor(hex);
  }

  /// Secondary color from branding
  Color get secondaryColor {
    final hex = _branding['secondary_color'] as String? ?? '#0d47a1';
    return _parseColor(hex);
  }

  /// Accent color from branding
  Color get accentColor {
    final hex = _branding['accent_color'] as String? ?? '#ff6f00';
    return _parseColor(hex);
  }

  /// Logo URL
  String get logoUrl => _branding['logo_url'] as String? ?? '';

  Color _parseColor(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }

  /// Initialize from stored preferences
  Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    _tenantId = prefs.getString('tenant_id') ?? 'platform';
    _tier = prefs.getString('tenant_tier') ?? 'starter';
    _appName = prefs.getString('tenant_app_name') ?? '54Bank';
    final featuresJson = prefs.getString('tenant_features');
    if (featuresJson != null) {
      _features = json.decode(featuresJson);
    }
    final brandingJson = prefs.getString('tenant_branding');
    if (brandingJson != null) {
      _branding = json.decode(brandingJson);
    }
    _initialized = true;
    notifyListeners();
  }

  /// Load tenant context from API
  Future<void> loadFromApi() async {
    try {
      // This would call the tenant-management service via the API gateway
      // For now, use defaults based on tier
      _initialized = true;
      notifyListeners();
    } catch (e) {
      // Use cached values
    }
  }

  /// Switch to a different tenant
  Future<void> switchTenant(String newTenantId) async {
    _tenantId = newTenantId;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('tenant_id', newTenantId);
    await loadFromApi();
  }

  /// Update tier (called when tenant management returns new features)
  void updateTier(String newTier, Map<String, dynamic> newFeatures) {
    _tier = newTier;
    _features = newFeatures;
    notifyListeners();
  }

  /// Update branding (called when white-label config changes)
  void updateBranding(Map<String, dynamic> newBranding) {
    _branding = newBranding;
    if (newBranding.containsKey('app_name')) {
      _appName = newBranding['app_name'];
    }
    notifyListeners();
  }

  /// Check if a specific agent is allowed
  bool isAgentAllowed(String agentId) => allowedAgents.contains(agentId);

  /// Check if a KPI role is allowed
  bool isKpiRoleAllowed(String role) => allowedKpiRoles.contains(role);

  /// Check if a graph tool is allowed
  bool isGraphToolAllowed(String toolId) => allowedGraphTools.contains(toolId);

  /// Check if a feature is allowed
  bool isFeatureAllowed(String feature) {
    final allowed = List<String>.from(_features['features'] ?? []);
    return allowed.contains(feature);
  }

  /// Get ThemeData based on tenant branding
  ThemeData getThemeData() {
    return ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: primaryColor),
      useMaterial3: true,
      appBarTheme: AppBarTheme(
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
      ),
    );
  }

  /// Save current state to preferences
  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('tenant_id', _tenantId);
    await prefs.setString('tenant_tier', _tier);
    await prefs.setString('tenant_app_name', _appName);
    await prefs.setString('tenant_features', json.encode(_features));
    await prefs.setString('tenant_branding', json.encode(_branding));
  }
}
