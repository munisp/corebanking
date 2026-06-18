import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;
import '../config/app_config.dart';
import '../models/tenant.dart';
import '../services/api_service.dart';

/// TenantService - matches web app implementation
/// Handles tenant configuration fetching, storage, and retrieval
class TenantService {
  static const String _tenantStorageKey = 'tenant_config';
  static const String _tenantIdStorageKey = 'tenant_id';

  /// Fetch tenant configuration from API
  /// Matches web app: ${AppConfig.tenantEndpoint}/tenant/${tenantId}
  static Future<TenantConfig> fetchTenantConfig(String tenantId) async {
    try {
      final apiService = ApiService();
      print('Fetching tenant configuration for tenant ID: $tenantId');
      print('API Endpoint: ${AppConfig.tenantEndpoint}/tenant/$tenantId');
      final response = await apiService.get(
        '${AppConfig.tenantEndpoint}/tenant/$tenantId',
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to fetch tenant config: ${response.statusCode}');
      }

      // Extract tenant data from response (matching web app structure)
      final serverResponse = response.data;
      final tenantData = serverResponse['tenant'] ?? serverResponse['data'] ?? serverResponse;
      
      if (tenantData == null) {
        throw Exception('No tenant data in API response');
      }

      // Transform tenant data (matching web app transformTenantData)
      final tenantConfig = TenantConfig.fromJson(tenantData as Map<String, dynamic>);
      
      // Save tenant ID to storage (matching web app)
      await saveTenantId(tenantId);
      
      return tenantConfig;
    } catch (error) {
      print('Error fetching tenant configuration: $error');
      rethrow;
    }
  }

  /// Save tenant configuration to storage
  /// Matches web app: localStorage.setItem('tenant_config', JSON.stringify(tenant))
  static Future<void> saveTenantConfig(TenantConfig tenant) async {
    try {
      final json = jsonEncode(tenant.toJson());
      if (kIsWeb) {
        html.window.localStorage[_tenantStorageKey] = json;
      } else {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_tenantStorageKey, json);
      }
    } catch (error) {
      print('Error saving tenant configuration: $error');
    }
  }

  /// Load tenant configuration from storage
  /// Matches web app: localStorage.getItem('tenant_config')
  static Future<TenantConfig?> loadTenantConfig() async {
    try {
      String? stored;
      if (kIsWeb) {
        stored = html.window.localStorage[_tenantStorageKey];
      } else {
        final prefs = await SharedPreferences.getInstance();
        stored = prefs.getString(_tenantStorageKey);
      }
      
      if (stored != null) {
        final json = jsonDecode(stored) as Map<String, dynamic>;
        return TenantConfig.fromJson(json);
      }
      return null;
    } catch (error) {
      print('Error loading tenant configuration: $error');
      return null;
    }
  }

  /// Clear tenant configuration from storage
  /// Matches web app: removes both 'tenant_config' and 'tenant_id'
  static Future<void> clearTenantConfig() async {
    try {
      if (kIsWeb) {
        html.window.localStorage.remove(_tenantStorageKey);
        html.window.localStorage.remove(_tenantIdStorageKey);
      } else {
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove(_tenantStorageKey);
        await prefs.remove(_tenantIdStorageKey);
      }
    } catch (error) {
      print('Error clearing tenant configuration: $error');
    }
  }

  /// Save tenant ID to storage
  /// Matches web app: localStorage.setItem('tenant_id', tenantId)
  static Future<void> saveTenantId(String tenantId) async {
    try {
      if (kIsWeb) {
        html.window.localStorage[_tenantIdStorageKey] = tenantId;
      } else {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_tenantIdStorageKey, tenantId);
      }
    } catch (error) {
      print('Error saving tenant ID: $error');
    }
  }

  /// Get tenant ID from storage
  /// Matches web app: localStorage.getItem('tenant_id')
  static Future<String?> getTenantId() async {
    try {
      if (kIsWeb) {
        return html.window.localStorage[_tenantIdStorageKey];
      } else {
        final prefs = await SharedPreferences.getInstance();
        return prefs.getString(_tenantIdStorageKey);
      }
    } catch (error) {
      print('Error getting tenant ID: $error');
      return null;
    }
  }

  /// Validate tenant configuration
  static bool validateTenantConfig(TenantConfig tenant) {
    if (tenant.id.isEmpty || tenant.name.isEmpty || tenant.domain.isEmpty) {
      print('Invalid tenant configuration: missing required fields');
      return false;
    }

    // Note: Branding and features are checked in TenantConfig model
    return true;
  }
}
