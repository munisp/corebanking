import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../config/app_config.dart';
import '../utils/error_handler.dart';

/// ==================== API REQUEST WRAPPER ====================

class ApiRequest<T> {
  final String endpoint;
  final String method; // GET, POST, PUT, DELETE, PATCH
  final Map<String, dynamic>? queryParameters;
  final dynamic data;
  final Duration? cacheExpiry;
  final bool useCache;
  final int maxRetries;
  final Duration retryDelay;
  final T? Function(dynamic)? parser;

  ApiRequest({
    required this.endpoint,
    required this.method,
    this.queryParameters,
    this.data,
    this.cacheExpiry,
    this.useCache = true,
    this.maxRetries = 3,
    this.retryDelay = const Duration(seconds: 1),
    this.parser,
  });

  bool get isCacheable => method == 'GET' && useCache;

  bool get isRetryable => method == 'GET';
}

/// ==================== API RESPONSE WRAPPER ====================

class ApiResponse<T> {
  final T? data;
  final String? error;
  final int? statusCode;
  final bool isSuccess;
  final bool isFromCache;
  final bool isOffline;
  final String? rawResponse;

  const ApiResponse({
    this.data,
    this.error,
    this.statusCode,
    required this.isSuccess,
    this.isFromCache = false,
    this.isOffline = false,
    this.rawResponse,
  });

  factory ApiResponse.success(T data, {bool isFromCache = false}) {
    return ApiResponse<T>(
      data: data,
      isSuccess: true,
      isFromCache: isFromCache,
    );
  }

  factory ApiResponse.error(
    String error, {
    int? statusCode,
    bool isOffline = false,
  }) {
    return ApiResponse<T>(
      error: error,
      statusCode: statusCode,
      isSuccess: false,
      isOffline: isOffline,
    );
  }

  T getOrThrow() {
    if (isSuccess && data != null) return data as T;
    throw AppException(error ?? 'Unknown error', code: 'API_RESPONSE_ERROR');
  }

  R fold<R>(
    R Function(String error, int? statusCode) onError,
    R Function(T data, bool isFromCache) onSuccess,
  ) {
    if (isSuccess && data != null) {
      return onSuccess(data as T, isFromCache);
    }
    return onError(error ?? 'Unknown error', statusCode);
  }
}

/// ==================== API SERVICE ====================

class EnhancedApiService {
  EnhancedApiService._();
  static final EnhancedApiService _instance = EnhancedApiService._();

  static EnhancedApiService get instance => _instance;

  late final Dio _dio;
  final Map<String, CachedResponse> _cache = {};
  final Map<String, DateTime> _cacheExpiry = {};

  bool _isInitialized = false;

  void initialize({
    String? baseUrl,
    Duration connectTimeout = const Duration(seconds: 30),
    Duration receiveTimeout = const Duration(seconds: 30),
    bool debug = false,
  }) {
    if (_isInitialized) return;

    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl ?? AppConfig.baseUrl,
        connectTimeout: connectTimeout,
        receiveTimeout: receiveTimeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Add interceptors
    _dio.interceptors.add(_AuthInterceptor());
    _dio.interceptors.add(_ErrorInterceptor());
    if (debug) {
      _dio.interceptors.add(LogInterceptor(
        requestBody: true,
        responseBody: true,
      ));
    }

    _isInitialized = true;
  }

  /// GET request with full options
  Future<ApiResponse<T>> get<T>(
    String endpoint, {
    Map<String, dynamic>? queryParameters,
    T? Function(dynamic)? parser,
    Duration? cacheExpiry,
    bool useCache = true,
    int maxRetries = 3,
  }) async {
    return _executeRequest<T>(
      ApiRequest<T>(
        endpoint: endpoint,
        method: 'GET',
        queryParameters: queryParameters,
        parser: parser,
        cacheExpiry: cacheExpiry,
        useCache: useCache,
        maxRetries: maxRetries,
      ),
    );
  }

  /// POST request
  Future<ApiResponse<T>> post<T>(
    String endpoint, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    T? Function(dynamic)? parser,
  }) async {
    return _executeRequest<T>(
      ApiRequest<T>(
        endpoint: endpoint,
        method: 'POST',
        queryParameters: queryParameters,
        data: data,
        parser: parser,
        useCache: false,
        maxRetries: 1, // Don't retry POST
      ),
    );
  }

  /// PUT request
  Future<ApiResponse<T>> put<T>(
    String endpoint, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    T? Function(dynamic)? parser,
  }) async {
    return _executeRequest<T>(
      ApiRequest<T>(
        endpoint: endpoint,
        method: 'PUT',
        queryParameters: queryParameters,
        data: data,
        parser: parser,
        useCache: false,
        maxRetries: 1,
      ),
    );
  }

  /// PATCH request
  Future<ApiResponse<T>> patch<T>(
    String endpoint, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    T? Function(dynamic)? parser,
  }) async {
    return _executeRequest<T>(
      ApiRequest<T>(
        endpoint: endpoint,
        method: 'PATCH',
        queryParameters: queryParameters,
        data: data,
        parser: parser,
        useCache: false,
        maxRetries: 1,
      ),
    );
  }

  /// DELETE request
  Future<ApiResponse<T>> delete<T>(
    String endpoint, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    T? Function(dynamic)? parser,
  }) async {
    return _executeRequest<T>(
      ApiRequest<T>(
        endpoint: endpoint,
        method: 'DELETE',
        queryParameters: queryParameters,
        data: data,
        parser: parser,
        useCache: false,
        maxRetries: 1,
      ),
    );
  }

  /// Internal request execution with retry and caching
  Future<ApiResponse<T>> _executeRequest<T>(ApiRequest<T> request) async {
    // Check cache first
    if (request.isCacheable && _isResponseCached(request.endpoint)) {
      final cachedResponse = _cache[request.endpoint];
      if (cachedResponse != null && !_isResponseExpired(request.endpoint)) {
        try {
          final data = request.parser != null
              ? request.parser!(cachedResponse.data)
              : cachedResponse.data as T;
          return ApiResponse<T>.success(data as T, isFromCache: true);
        } catch (e) {
          // Continue with fresh request if parsing fails
        }
      }
    }

    // Execute with retry logic
    AppException? lastException;
    for (int attempt = 0; attempt < request.maxRetries; attempt++) {
      try {
        final response = await _performRequest(request);
        final parsedData = request.parser != null
            ? request.parser!(response.data)
            : response.data as T;

        // Cache if applicable
        if (request.isCacheable) {
          _cache[request.endpoint] = CachedResponse(response.data, DateTime.now());
          if (request.cacheExpiry != null) {
            _cacheExpiry[request.endpoint] = DateTime.now().add(request.cacheExpiry!);
          }
        }

        return ApiResponse<T>.success(parsedData as T);
      } on AppException catch (e) {
        lastException = e;
        if (!request.isRetryable || attempt == request.maxRetries - 1) {
          return _handleApiError<T>(e);
        }
        await Future.delayed(request.retryDelay * (attempt + 1));
      } catch (e) {
        lastException = ErrorHandler.handle(e);
        if (!request.isRetryable || attempt == request.maxRetries - 1) {
          return _handleApiError<T>(lastException as AppException);
        }
        await Future.delayed(request.retryDelay * (attempt + 1));
      }
    }

    return _handleApiError<T>(lastException ?? GenericException('Unknown error'));
  }

  /// Perform the actual HTTP request
  Future<Response> _performRequest<T>(ApiRequest<T> request) async {
    try {
      final response = await _dio.request(
        request.endpoint,
        queryParameters: request.queryParameters,
        data: request.data,
        options: Options(method: request.method),
      );

      if (response.statusCode != null && response.statusCode! >= 400) {
        throw ApiException(
          'HTTP ${response.statusCode}',
          statusCode: response.statusCode!,
          responseBody: response.data,
        );
      }

      return response;
    } on DioException catch (e) {
      throw ErrorHandler.handle(e);
    } on AppException {
      rethrow;
    } catch (e) {
      throw ErrorHandler.handle(e);
    }
  }

  /// Handle API errors
  ApiResponse<T> _handleApiError<T>(AppException error) {
    if (kDebugMode) {
      print('API Error: ${error.message}');
    }

    return ApiResponse<T>.error(
      error.displayMessage,
      statusCode: error is ApiException ? error.statusCode : null,
      isOffline: error is OfflineException,
    );
  }

  /// Cache management
  bool _isResponseCached(String endpoint) => _cache.containsKey(endpoint);

  bool _isResponseExpired(String endpoint) {
    if (!_cacheExpiry.containsKey(endpoint)) return false;
    return DateTime.now().isAfter(_cacheExpiry[endpoint]!);
  }

  void clearCache([String? endpoint]) {
    if (endpoint != null) {
      _cache.remove(endpoint);
      _cacheExpiry.remove(endpoint);
    } else {
      _cache.clear();
      _cacheExpiry.clear();
    }
  }

  /// Set authorization token
  void setAuthToken(String token) {
    _dio.options.headers['Authorization'] = 'Bearer $token';
  }

  /// Clear authorization
  void clearAuth() {
    _dio.options.headers.remove('Authorization');
  }
}

/// ==================== CACHED RESPONSE ====================

class CachedResponse {
  final dynamic data;
  final DateTime cachedAt;

  CachedResponse(this.data, this.cachedAt);

  bool isExpired(Duration expiry) {
    return DateTime.now().difference(cachedAt).inSeconds > expiry.inSeconds;
  }
}

/// ==================== INTERCEPTORS ====================

class _AuthInterceptor extends QueuedInterceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // Add any additional auth headers if needed
    super.onRequest(options, handler);
  }
}

class _ErrorInterceptor extends QueuedInterceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    // Centralized error handling
    if (kDebugMode) {
      print('DIO Error: ${err.message}');
      print('Status Code: ${err.response?.statusCode}');
      print('Response: ${err.response?.data}');
    }

    super.onError(err, handler);
  }
}

/// ==================== SINGLETON PROVIDER ====================

final apiService = EnhancedApiService.instance;
