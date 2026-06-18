import 'dart:convert';
import 'dart:math' show min;
import 'package:dio/dio.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import 'package:flutter/foundation.dart' show kIsWeb, debugPrint;
import 'package:universal_html/html.dart' as html;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';
import 'local_storage_service.dart';
import '../models/paginated_response.dart';

class ApiService {
    /// Generic paginated GET request
    /// [T] is the type of each item in the paginated list
    /// [fromJson] is a function to convert each item to T
    Future<PaginatedResponse<T>> getPaginated<T>(
      String path, {
      int page = 1,
      int pageSize = 20,
      Map<String, dynamic>? queryParams,
      required T Function(dynamic) fromJson,
    }) async {
      final qp = <String, dynamic>{
        'page': page,
        'limit': pageSize,
        ...?queryParams,
      };
      final response = await _dio.get(path, queryParameters: qp);
      final data = response.data;
      final itemsRaw = (data['data'] ?? data['applications'] ?? data) as List? ?? [];
      final items = itemsRaw.map((item) => fromJson(item)).toList();
      final pagination = data['pagination'] ?? {};
      return PaginatedResponse<T>(
        items: items,
        total: pagination['total'] ?? items.length,
        page: pagination['page'] ?? page,
        pageSize: pagination['limit'] ?? pageSize,
        totalPages: pagination['total_pages'] ?? 1,
      );
    }
  late final Dio _dio;
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
      resetOnError: false,
    ),
  );

  ApiService() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.baseUrl,
        connectTimeout: Duration(seconds: AppConfig.apiTimeout),
        receiveTimeout: Duration(seconds: AppConfig.apiTimeout),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // ---------- Storage Helpers ----------
          Future<String?> getStorageValue(String key) async {
            return await LocalStorageService.getString(key);
          }

          Future<void> setStorageValue(String key, String value) async {
            await LocalStorageService.setString(key, value);
          }

          // ---------- Normalizer (FIX) ----------
          String normalizeKeycloakId(String value) {
            final trimmed = value.trim();

            if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
              try {
                return jsonDecode(trimmed);
              } catch (_) {
                return trimmed.replaceAll('"', '');
              }
            }

            return trimmed;
          }

          // ---------- Token ----------
          String? token;
          if (kIsWeb) {
            token = html.window.localStorage[AppConfig.accessTokenKey];
          } else {
            try {
              token = await _secureStorage.read(key: AppConfig.accessTokenKey);
            } catch (e) {
              debugPrint('[API] ⚠️  Secure storage read error: $e');
              debugPrint('[API] 🔄 Clearing corrupted secure storage...');
              try {
                await _secureStorage.deleteAll();
              } catch (_) {}
              token = null;
            }
          }

          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
            debugPrint('[API] ✓ Added Authorization header');
          } else {
            debugPrint('[API] ✗ No token found');
          }
          final switchName = "mojaloop";
          options.headers['x-tenant-name'] = AppConfig.CURRENT_TENANT_ID;
          options.headers['x-switch-name'] = switchName;
          options.headers['x-ams-name'] = "core_banking";
          // ---------- keycloak_id (CRITICAL) ----------
          String? keycloakId;

          debugPrint('[API] ========== KEYCLOAK_ID EXTRACTION START ==========');

          // Step 1: Try to extract from token
          if (token != null) {
            try {
              final decoded = JwtDecoder.decode(token);
              debugPrint('[API] ✓ Token decoded successfully');
              debugPrint('[API] Token fields available: ${decoded.keys.toList()}');

              final extracted = decoded['sub'] ??
                  decoded['keycloak_id'] ??
                  decoded['user_id'] ??
                  decoded['preferred_username'] ??
                  decoded['id'];

              if (extracted != null) {
                debugPrint('[API] ✓ Found in token (raw): $extracted');
                keycloakId = normalizeKeycloakId(extracted.toString());
                
                // Save to storage for future requests
                await setStorageValue('keycloak_id', keycloakId);
                debugPrint('[API] ✓ Normalized and saved: $keycloakId');
              } else {
                debugPrint('[API] ✗ No keycloak_id field in token');
                debugPrint('[API] Available token fields: ${decoded.keys.join(", ")}');
              }
            } catch (e) {
              debugPrint('[API] ✗ Token decode error: $e');
            }
          } else {
            debugPrint('[API] ✗ No token available to decode');
          }

          // Step 2: Try to get from storage
          if (keycloakId == null || keycloakId.isEmpty) {
            debugPrint('[API] Attempting to retrieve from storage...');
            
            // Try LocalStorageService
            keycloakId = await getStorageValue('keycloak_id');
            
            if (keycloakId != null && keycloakId.isNotEmpty) {
              debugPrint('[API] ✓ Retrieved from storage (raw): $keycloakId');
              keycloakId = normalizeKeycloakId(keycloakId);
              debugPrint('[API] ✓ After normalization: $keycloakId');
            } else {
              debugPrint('[API] ✗ Not found in LocalStorageService');
              
              // For web, try direct access
              if (kIsWeb) {
                final directValue = html.window.localStorage['keycloak_id'];
                debugPrint('[API] Direct web localStorage value: $directValue');
                
                if (directValue != null && directValue.isNotEmpty) {
                  keycloakId = normalizeKeycloakId(directValue);
                  debugPrint('[API] ✓ Got from direct web access: $keycloakId');
                }
              }
            }
          }

          // Final status
          debugPrint('[API] Final keycloak_id value: $keycloakId');
          
          // Check if this is an auth endpoint that doesn't require x-keycloak-id
          final isAuthEndpoint = options.path.contains('/auth/login') || 
                                 options.path.contains('/auth/register') ||
                                 options.path.contains('/auth/refresh') ||
                                 options.path.contains('/auth/forgot-password') ||
                                 options.path.contains('/auth/reset-password') ||
                                 options.path.contains('/auth/verify-otp') ||
                                 options.path.contains('/auth/verify-email');
          
          if (keycloakId != null && keycloakId.isNotEmpty) {
            options.headers['x-keycloak-id'] = keycloakId;
            debugPrint('[API] ✓✓✓ SUCCESS: x-keycloak-id header SET: $keycloakId');
          } else if (!isAuthEndpoint) {
            debugPrint('[API] ✗✗✗ CRITICAL FAILURE: No keycloak_id available!');
            debugPrint('[API] Request path: ${options.path}');
            debugPrint('[API] This request WILL FAIL with missing header error!');
            
            // Emergency diagnostic
            if (kIsWeb) {
              debugPrint('[API] === EMERGENCY DIAGNOSTIC ===');
              debugPrint('[API] All localStorage keys: ${html.window.localStorage.keys.toList()}');
              debugPrint('[API] keycloak_id: ${html.window.localStorage['keycloak_id']}');
              debugPrint('[API] user: ${html.window.localStorage['user']}');
            } else {
              // For mobile, try to read from secure storage as well
              try {
                final secureKeycloakId = await _secureStorage.read(key: 'keycloak_id');
                debugPrint('[API] SecureStorage keycloak_id: $secureKeycloakId');
              } catch (e) {
                debugPrint('[API] Error reading from SecureStorage: $e');
              }
            }
          } else {
            debugPrint('[API] Auth endpoint detected, skipping x-keycloak-id header requirement');
          }
          
          debugPrint('[API] ========== KEYCLOAK_ID EXTRACTION END ==========');

          // ---------- Default Account ----------
          try {
            String? accountId;
            final userStr = await getStorageValue('user');
            if (userStr != null && userStr.isNotEmpty) {
              final user = jsonDecode(userStr);
              accountId = (user['account_id'] ?? user['accountId'])?.toString();
            }
            accountId ??= await getStorageValue('account_id');
            if (accountId != null) {
              options.headers['x-default-account-id'] = accountId;
            }
          } catch (_) {}

          // ---------- Tenant + Feature Flags ----------
          try {
            final tenantStr = await getStorageValue('tenant_config');
            if (tenantStr != null) {
              final tenant = jsonDecode(tenantStr) as Map<String, dynamic>;

              final tenantId = tenant['tenant_id'] ?? tenant['id'];
              final switchName = "mojaloop";
              options.headers['x-switch-name'] = switchName;
              options.headers['x-ams-name'] = "core_banking";
              if (tenantId != null) {
                options.headers['x-tenant-id'] = tenantId.toString();
                
              }

              final featureFlags = tenant['feature_flags'];

              if (featureFlags is List) {
                Map<String, dynamic>? auth;
                Map<String, dynamic>? accounts;

                for (final flag in featureFlags) {
                  if (flag['name'] == 'auth' &&
                      flag['is_enabled'] == true) {
                    auth = flag;
                  }
                  if (flag['name'] == 'accounts' &&
                      flag['is_enabled'] == true) {
                    accounts = flag;
                  }
                }

                if (auth?['config'] != null) {
                  options.headers['x-keycloak-realm'] =
                      auth!['config']['realm']?.toString();
                  options.headers['x-keycloak-pub-key'] =
                      auth['config']['public_rsa_key']?.toString();
                }

                if (accounts?['config']?['account'] != null) {
                  final acc = accounts!['config']['account'];
                  options.headers['x-mint-account-id'] =
                      acc['id']?.toString();
                  options.headers['x-mint-id'] =
                      acc['id']?.toString();
                  options.headers['x-ledger-id'] =
                      acc['ledger_id']?.toString();
                }
              }
            }
          } catch (_) {}

          // Ensure x-tenant-id is always set — fall back to compile-time constant when
          // tenant_config is not yet in storage (e.g. first launch before login).
          if (!options.headers.containsKey('x-tenant-id')) {
            options.headers['x-tenant-id'] = AppConfig.CURRENT_TENANT_ID;
            debugPrint('[API] x-tenant-id fallback: ${AppConfig.CURRENT_TENANT_ID}');
          }

          if (!options.headers.containsKey('x-ledger-id')) {
            debugPrint('[API] ✗ x-ledger-id not set — accounts feature flag missing from tenant config');
          }

          // Final header debug
          debugPrint('[API] === REQUEST HEADERS ===');
          debugPrint('[API] x-keycloak-id: ${options.headers['x-keycloak-id']}');
          debugPrint('[API] x-tenant-id: ${options.headers['x-tenant-id']}');
          debugPrint('[API] x-default-account-id: ${options.headers['x-default-account-id']}');
          debugPrint('[API] =========================');

          return handler.next(options);
        },

        // ---------- 401 Refresh ----------
        onError: (error, handler) async {
          if (error.response?.statusCode == 401) {
            // Check if this is a login/auth endpoint - don't clear storage for failed login attempts
            final isAuthEndpoint = error.requestOptions.path.contains('/auth/login') || 
                                   error.requestOptions.path.contains('/auth/register') ||
                                   error.requestOptions.path.contains('/auth/verify-otp') ||
                                   error.requestOptions.path.contains('/auth/verify-email');
            
            if (isAuthEndpoint) {
              // For auth endpoints, just pass the error through without clearing storage
              debugPrint('[API] 401 on auth endpoint, not clearing storage');
              return handler.next(error);
            }
            
            try {
              debugPrint('[API] 401 error, attempting token refresh...');
              await _refreshToken();
              final response = await _dio.request(
                error.requestOptions.path,
                options: Options(
                  method: error.requestOptions.method,
                  headers: error.requestOptions.headers,
                ),
                data: error.requestOptions.data,
                queryParameters:
                    error.requestOptions.queryParameters,
              );
              return handler.resolve(response);
            } catch (e) {
              debugPrint('[API] Token refresh failed: $e');
              // Only wipe storage when the refresh token itself is rejected (401),
              // meaning the session is truly over. Any other failure (404, 500,
              // network error, no refresh token) is transient or a config problem —
              // clearing storage in those cases logs the user out unnecessarily.
              final isRefreshTokenInvalid = (e is DioException &&
                      e.response?.statusCode == 401) ||
                  e.toString().contains('No refresh token');
              if (isRefreshTokenInvalid) {
                await clearStorage();
              }
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  // ---------- Refresh Token ----------
  Future<void> _refreshToken() async {
    String? refreshToken;

    if (kIsWeb) {
      refreshToken =
          html.window.localStorage[AppConfig.refreshTokenKey];
    } else {
      refreshToken = await _secureStorage.read(
          key: AppConfig.refreshTokenKey);
    }

    if (refreshToken == null) {
      throw Exception('No refresh token');
    }

    final response = await _dio.post(
      '/token/refresh/$refreshToken',
    );

    final data = response.data['data'] ?? response.data;

    if (kIsWeb) {
      html.window.localStorage[AppConfig.accessTokenKey] =
          data['access_token'];
      html.window.localStorage[AppConfig.refreshTokenKey] =
          data['refresh_token'];
    } else {
      await _secureStorage.write(
          key: AppConfig.accessTokenKey,
          value: data['access_token']);
      await _secureStorage.write(
          key: AppConfig.refreshTokenKey,
          value: data['refresh_token']);
    }
  }

  // ---------- HTTP METHODS ----------
  Future<Response> get(String path,
          {Map<String, dynamic>? queryParameters}) =>
      _dio.get(path, queryParameters: queryParameters);

  Future<Response> post(String path,
          {dynamic data, Map<String, dynamic>? queryParameters}) =>
      _dio.post(path,
          data: data, queryParameters: queryParameters);

  Future<Response> put(String path,
          {dynamic data, Map<String, dynamic>? queryParameters}) =>
      _dio.put(path,
          data: data, queryParameters: queryParameters);

  Future<Response> delete(String path,
          {Map<String, dynamic>? queryParameters}) =>
      _dio.delete(path, queryParameters: queryParameters);

  // ---------- Get Transaction by ID ----------
  Future<Map<String, dynamic>> getTransactionById(String transactionId) async {
    try {
      final response = await get('/ledger/txn/$transactionId');
      if (response.statusCode == 200 && response.data != null) {
        return response.data;
      } else {
        throw Exception('Failed to fetch transaction: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('Error fetching transaction: $e');
      rethrow;
    }
  }

  // ---------- Clear Storage ----------
  Future<void> clearStorage() async {
    await _secureStorage.deleteAll();
    await LocalStorageService.clear();
  }
  
  // ---------- Debug Helper (call this manually to diagnose) ----------
  Future<void> debugStorage() async {
    debugPrint('========== STORAGE DIAGNOSTIC ==========');
    
    if (kIsWeb) {
      debugPrint('Platform: WEB');
      debugPrint('All localStorage keys:');
      for (var key in html.window.localStorage.keys) {
        final value = html.window.localStorage[key];
        final preview = value != null && value.length > 50 
            ? '${value.substring(0, 50)}...' 
            : value;
        debugPrint('  $key: $preview');
      }
    } else {
      debugPrint('Platform: MOBILE');
    }
    
    final keys = await LocalStorageService.getKeys();
    debugPrint('LocalStorageService keys: $keys');
    
    final keycloakId = await LocalStorageService.getString('keycloak_id');
    debugPrint('LocalStorageService keycloak_id: $keycloakId');
    
    final user = await LocalStorageService.getString('user');
    debugPrint('LocalStorageService user: ${user?.substring(0, min(100, user.length))}');
    
    debugPrint('========================================');
  }
}