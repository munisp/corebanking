import 'dart:convert';
import 'dart:math' show min;
import 'package:dio/dio.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import 'package:flutter/foundation.dart' show kIsWeb, kDebugMode, debugPrint;
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

  /// Shared singleton: every `ApiService()` call (including the Provider
  /// registration in main.dart) returns this instance, so a single Dio and
  /// its connection pool (keep-alive) are reused app-wide (MOB-01).
  static final ApiService _shared = ApiService._internal();
  factory ApiService() => _shared;

  /// In-memory cache of auth/prefs-derived request headers, loaded once and
  /// reused across requests instead of hitting secure storage /
  /// SharedPreferences on every call (MOB-02). `null` means "not loaded yet"
  /// (missing keys are re-read each request until found, so values written
  /// later during login/tenant bootstrap are still picked up).
  String? _cachedToken;
  String? _cachedKeycloakId;
  String? _cachedAccountId;
  Map<String, String>? _cachedTenantHeaders;
  String? _lastDecodedToken;

  /// Drop all cached auth/header state. Called automatically on token
  /// refresh and [clearStorage]; auth flows (login/logout) should call this
  /// after writing/removing tokens.
  static void invalidateAuthCache() => _shared._invalidateAuthCache();

  void _invalidateAuthCache() {
    _cachedToken = null;
    _cachedKeycloakId = null;
    _cachedAccountId = null;
    _cachedTenantHeaders = null;
    _lastDecodedToken = null;
  }

  ApiService._internal() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.baseUrl,
        connectTimeout: Duration(seconds: AppConfig.apiConnectTimeout),
        receiveTimeout: Duration(seconds: AppConfig.apiReceiveTimeout),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // MOB-09: decode large JSON responses in a background isolate instead of
    // on the UI thread (not supported on web).
    if (!kIsWeb) {
      _dio.transformer = BackgroundTransformer();
    }

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Resolve token/prefs-derived headers from the in-memory cache
          // (storage is only hit for keys not yet cached) — MOB-02.
          await _primeAuthCache();

          final token = _cachedToken;
          // W12-A4A: the token-refresh call carries the REFRESH token in its
          // own Authorization header (auth-service token.py:102 contract) —
          // never overwrite it with the (expired) access token.
          final isRefreshCall = options.path.contains('/token/refresh');
          if (token != null && !isRefreshCall) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          options.headers['x-tenant-name'] = AppConfig.CURRENT_TENANT_ID;
          options.headers['x-switch-name'] = 'mojaloop';
          options.headers['x-ams-name'] = 'core_banking';

          final keycloakId = _cachedKeycloakId;
          if (keycloakId != null && keycloakId.isNotEmpty) {
            options.headers['x-keycloak-id'] = keycloakId;
          } else if (kDebugMode) {
            final isAuthEndpoint = options.path.contains('/auth/login') ||
                options.path.contains('/auth/register') ||
                options.path.contains('/auth/refresh') ||
                options.path.contains('/auth/forgot-password') ||
                options.path.contains('/auth/reset-password') ||
                options.path.contains('/auth/verify-otp') ||
                options.path.contains('/auth/verify-email');
            if (!isAuthEndpoint) {
              debugPrint('[API] No keycloak_id available for ${options.path}');
            }
          }

          if (_cachedAccountId != null) {
            options.headers['x-default-account-id'] = _cachedAccountId;
          }

          _cachedTenantHeaders?.forEach((k, v) => options.headers[k] = v);

          // Ensure x-tenant-id is always set — fall back to compile-time
          // constant when tenant_config is not yet in storage (e.g. first
          // launch before login).
          options.headers['x-tenant-id'] ??= AppConfig.CURRENT_TENANT_ID;

          return handler.next(options);
        },

        // ---------- 401 Refresh ----------
        onError: (error, handler) async {
          if (error.response?.statusCode == 401) {
            // Check if this is a login/auth endpoint - don't clear storage for failed login attempts
            final isAuthEndpoint = error.requestOptions.path.contains('/auth/login') ||
                                   error.requestOptions.path.contains('/auth/register') ||
                                   error.requestOptions.path.contains('/auth/verify-otp') ||
                                   error.requestOptions.path.contains('/auth/verify-email') ||
                                   // W12-A4A: double-prefix gateway forms (gateway strips the
                                   // first /auth segment; service serves /auth/<x>)
                                   error.requestOptions.path.contains('/auth/auth/login') ||
                                   error.requestOptions.path.contains('/auth/auth/register') ||
                                   error.requestOptions.path.contains('/auth/auth/verify-otp') ||
                                   error.requestOptions.path.contains('/auth/auth/verify-email') ||
                                   // Never refresh-in-response-to-a-failed-refresh (recursion)
                                   error.requestOptions.path.contains('/token/refresh');
            
            if (isAuthEndpoint) {
              // For auth endpoints, just pass the error through without clearing storage
              if (kDebugMode) {
                debugPrint('[API] 401 on auth endpoint, not clearing storage');
              }
              return handler.next(error);
            }

            try {
              if (kDebugMode) {
                debugPrint('[API] 401 error, attempting token refresh...');
              }
              await _refreshToken();
              _invalidateAuthCache(); // pick up the fresh token on retry
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
              if (kDebugMode) debugPrint('[API] Token refresh failed: $e');
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

  // ---------- Auth/header cache priming (MOB-02) ----------
  /// Loads token, keycloak_id, account id and tenant headers into memory.
  /// Each key is read from storage only until it is found; found values are
  /// reused until [invalidateAuthCache] is called (login/logout/refresh/401).
  /// The JWT is decoded only when the token actually changes.
  Future<void> _primeAuthCache() async {
    // ----- Token -----
    if (_cachedToken == null) {
      if (kIsWeb) {
        _cachedToken = html.window.localStorage[AppConfig.accessTokenKey];
      } else {
        try {
          _cachedToken =
              await _secureStorage.read(key: AppConfig.accessTokenKey);
        } catch (e) {
          if (kDebugMode) {
            debugPrint('[API] Secure storage read error: $e — clearing');
          }
          try {
            await _secureStorage.deleteAll();
          } catch (_) {}
          _cachedToken = null;
        }
      }
    }

    // ----- keycloak_id (decode JWT only when token changes) -----
    final token = _cachedToken;
    if (token != null && token != _lastDecodedToken) {
      _lastDecodedToken = token;
      try {
        final decoded = JwtDecoder.decode(token);
        final extracted = decoded['sub'] ??
            decoded['keycloak_id'] ??
            decoded['user_id'] ??
            decoded['preferred_username'] ??
            decoded['id'];
        if (extracted != null) {
          _cachedKeycloakId = _normalizeKeycloakId(extracted.toString());
          await LocalStorageService.setString(
              'keycloak_id', _cachedKeycloakId!);
        }
      } catch (e) {
        if (kDebugMode) debugPrint('[API] Token decode error: $e');
      }
    }
    if (_cachedKeycloakId == null) {
      final stored = await LocalStorageService.getString('keycloak_id');
      if (stored != null && stored.isNotEmpty) {
        _cachedKeycloakId = _normalizeKeycloakId(stored);
      } else if (kIsWeb) {
        final direct = html.window.localStorage['keycloak_id'];
        if (direct != null && direct.isNotEmpty) {
          _cachedKeycloakId = _normalizeKeycloakId(direct);
        }
      }
    }

    // ----- Default account -----
    if (_cachedAccountId == null) {
      try {
        final userStr = await LocalStorageService.getString('user');
        if (userStr != null && userStr.isNotEmpty) {
          final user = jsonDecode(userStr);
          _cachedAccountId =
              (user['account_id'] ?? user['accountId'])?.toString();
        }
        _cachedAccountId ??= await LocalStorageService.getString('account_id');
      } catch (_) {}
    }

    // ----- Tenant + feature-flag headers -----
    if (_cachedTenantHeaders == null) {
      try {
        final tenantStr = await LocalStorageService.getString('tenant_config');
        if (tenantStr != null) {
          final tenant = jsonDecode(tenantStr) as Map<String, dynamic>;
          final headers = <String, String>{};

          final tenantId = tenant['tenant_id'] ?? tenant['id'];
          if (tenantId != null) {
            headers['x-tenant-id'] = tenantId.toString();
          }

          final featureFlags = tenant['feature_flags'];
          if (featureFlags is List) {
            Map<String, dynamic>? auth;
            Map<String, dynamic>? accounts;

            for (final flag in featureFlags) {
              if (flag['name'] == 'auth' && flag['is_enabled'] == true) {
                auth = flag;
              }
              if (flag['name'] == 'accounts' && flag['is_enabled'] == true) {
                accounts = flag;
              }
            }

            if (auth?['config'] != null) {
              final realm = auth!['config']['realm']?.toString();
              final pubKey = auth['config']['public_rsa_key']?.toString();
              if (realm != null) headers['x-keycloak-realm'] = realm;
              if (pubKey != null) headers['x-keycloak-pub-key'] = pubKey;
            }

            if (accounts?['config']?['account'] != null) {
              final acc = accounts!['config']['account'];
              final accId = acc['id']?.toString();
              final ledgerId = acc['ledger_id']?.toString();
              if (accId != null) {
                headers['x-mint-account-id'] = accId;
                headers['x-mint-id'] = accId;
              }
              if (ledgerId != null) headers['x-ledger-id'] = ledgerId;
            }
          }
          _cachedTenantHeaders = headers;
        }
      } catch (_) {}
    }
  }

  String _normalizeKeycloakId(String value) {
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

    // W12-A4A: was '/token/refresh/$refreshToken' — no apisix /token/* rule
    // exists, so every refresh 404'd and every 401 forced a re-login.
    // auth-service.yaml strips the first /auth segment → auth-service serves
    // POST /token/refresh (api/v1/token.py:102) with the refresh token in the
    // Authorization Bearer header (never in the URL — M-43).
    final response = await _dio.post(
      '/auth/token/refresh',
      options: Options(headers: {'Authorization': 'Bearer $refreshToken'}),
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
    _invalidateAuthCache();
  }

  // ---------- HTTP METHODS ----------
  Future<Response> get(String path,
          {Map<String, dynamic>? queryParameters, Options? options}) =>
      _dio.get(path, queryParameters: queryParameters, options: options);

  Future<Response> post(String path,
          {dynamic data,
          Map<String, dynamic>? queryParameters,
          Options? options}) =>
      _dio.post(path,
          data: data, queryParameters: queryParameters, options: options);

  Future<Response> put(String path,
          {dynamic data,
          Map<String, dynamic>? queryParameters,
          Options? options}) =>
      _dio.put(path,
          data: data, queryParameters: queryParameters, options: options);

  Future<Response> delete(String path,
          {Map<String, dynamic>? queryParameters, Options? options}) =>
      _dio.delete(path, queryParameters: queryParameters, options: options);

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
    _invalidateAuthCache();
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