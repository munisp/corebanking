import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../models/error_response.dart';

class ErrorHandlerService {
  /// Main error handler - parses structured error responses and returns user-friendly messages
  static String handleError(dynamic error) {
    final errorResponse = parseError(error);
    return errorResponse.userMessage;
  }

  /// Parse error into structured ErrorResponse object
  static ErrorResponse parseError(dynamic error) {
    // Handle Dio network errors
    if (error is DioException) {
      debugPrint('[ErrorHandler] DioException type: ${error.type}');
      debugPrint('[ErrorHandler] Status code: ${error.response?.statusCode}');
      debugPrint('[ErrorHandler] Response data: ${error.response?.data}');

      switch (error.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return ErrorResponse(
            code: 'NETWORK_TIMEOUT',
            message: 'Connection timeout. Please check your internet connection and try again.',
            status: 0,
          );
        
        case DioExceptionType.connectionError:
          return ErrorResponse(
            code: 'NETWORK_ERROR',
            message: 'No internet connection. Please check your network and try again.',
            status: 0,
          );
        
        case DioExceptionType.cancel:
          return ErrorResponse(
            code: 'REQUEST_CANCELLED',
            message: 'Request was cancelled.',
            status: 0,
          );
        
        case DioExceptionType.badCertificate:
          return ErrorResponse(
            code: 'CERTIFICATE_ERROR',
            message: 'Security certificate error. Please check your connection.',
            status: 0,
          );
        
        case DioExceptionType.badResponse:
          return _parseBackendError(error.response?.data, error.response?.statusCode);
        
        case DioExceptionType.unknown:
          return _handleUnknownError(error);
      }
    }

    // Handle direct backend error data
    return _parseBackendError(error, null);
  }

  /// Parse structured error response from backend
  static ErrorResponse _parseBackendError(dynamic data, int? statusCode) {
    debugPrint('[ErrorHandler] Parsing backend error: $data');
    
    if (data == null) {
      return ErrorResponse(
        code: _getDefaultErrorCode(statusCode),
        message: 'An error occurred. Please try again.',
        status: statusCode ?? 500,
      );
    }

    // Parse structured error response (matches backend format)
    if (data is Map<String, dynamic>) {
      // PRIORITY 1: Check for nested 'detail' object (new backend format)
      // Example: { "detail": { "message": "Invalid credentials.", "code": "AUTH-AUTH-INT-4003", "status": "error" } }
      if (data['detail'] is Map<String, dynamic>) {
        final detail = data['detail'] as Map<String, dynamic>;
        final message = detail['message'];
        final code = detail['code'];
        final status = detail['status'];
        
        if (message != null && message.toString().trim().isNotEmpty) {
          // Map status code if needed
          int statusCodeValue = statusCode ?? 500;
          if (status == 'error' && statusCode == null) {
            // Try to infer status code from the error code
            if (code != null && code.toString().contains('4003')) {
              statusCodeValue = 401; // Unauthorized
            }
          }
          
          return ErrorResponse(
            code: code?.toString() ?? _getDefaultErrorCode(statusCodeValue),
            message: message.toString(),
            status: statusCodeValue,
            details: detail['service'],
          );
        }
      }
      
      // PRIORITY 2: Check if this is our structured error format (direct code & message)
      if (data.containsKey('code') && data.containsKey('message')) {
        try {
          return ErrorResponse.fromJson(data);
        } catch (e) {
          debugPrint('[ErrorHandler] Failed to parse ErrorResponse: $e');
        }
      }

      // PRIORITY 3: Legacy error formats - try to extract meaningful message
      final message = data['message'] ?? 
                     data['error'] ?? 
                     data['error_description'];
      
      if (message != null && message.toString().trim().isNotEmpty) {
        final messageStr = message.toString();
        final actualStatus = data['status'] ?? statusCode ?? 500;
        
        // Smart error code detection - check message content for auth errors
        String errorCode;
        if (_isAuthenticationError(messageStr)) {
          errorCode = 'ERROR_UNAUTHORIZED';
        } else {
          errorCode = data['code']?.toString() ?? _getDefaultErrorCode(actualStatus);
        }
        
        return ErrorResponse(
          code: errorCode,
          message: messageStr,
          status: actualStatus,
          details: data['details'],
        );
      }

      // Check nested data object
      if (data['data'] is Map) {
        final nestedData = data['data'] as Map<String, dynamic>;
        final nestedMessage = nestedData['message'] ?? nestedData['error'];
        if (nestedMessage != null && nestedMessage.toString().trim().isNotEmpty) {
          return ErrorResponse(
            code: nestedData['code']?.toString() ?? _getDefaultErrorCode(statusCode ?? nestedData['status']),
            message: nestedMessage.toString(),
            status: nestedData['status'] ?? statusCode ?? 500,
            details: nestedData['details'],
          );
        }
      }

      // Check for validation errors array
      if (data['errors'] is List) {
        final errors = data['errors'] as List;
        if (errors.isNotEmpty) {
          return ErrorResponse(
            code: data['code']?.toString() ?? 'VALIDATION_ERROR',
            message: errors.first.toString(),
            status: statusCode ?? 400,
            details: {'errors': errors},
          );
        }
      }
    }

    // Handle string error
    if (data is String && data.trim().isNotEmpty) {
      return ErrorResponse(
        code: _getDefaultErrorCode(statusCode),
        message: data,
        status: statusCode ?? 500,
      );
    }

    // Handle list of errors
    if (data is List && data.isNotEmpty) {
      return ErrorResponse(
        code: _getDefaultErrorCode(statusCode),
        message: data.first.toString(),
        status: statusCode ?? 500,
        details: {'errors': data},
      );
    }

    // Fallback
    return ErrorResponse(
      code: _getDefaultErrorCode(statusCode),
      message: 'An error occurred. Please try again.',
      status: statusCode ?? 500,
      details: data,
    );
  }

  /// Get default error code based on HTTP status code
  static String _getDefaultErrorCode(int? statusCode) {
    if (statusCode == null) return 'ERROR_UNKNOWN';
    
    // Map HTTP status codes to error codes
    switch (statusCode) {
      case 400:
        return 'ERROR_BAD_REQUEST';
      case 401:
        return 'ERROR_UNAUTHORIZED';
      case 403:
        return 'ERROR_FORBIDDEN';
      case 404:
        return 'ERROR_NOT_FOUND';
      case 409:
        return 'ERROR_CONFLICT';
      case 422:
        return 'ERROR_VALIDATION';
      case 429:
        return 'ERROR_RATE_LIMIT';
      case 500:
        return 'ERROR_INTERNAL_SERVER';
      case 502:
        return 'ERROR_BAD_GATEWAY';
      case 503:
        return 'ERROR_SERVICE_UNAVAILABLE';
      case 504:
        return 'ERROR_GATEWAY_TIMEOUT';
      default:
        if (statusCode >= 400 && statusCode < 500) {
          return 'ERROR_CLIENT_$statusCode';
        } else if (statusCode >= 500) {
          return 'ERROR_SERVER_$statusCode';
        }
        return 'ERROR_$statusCode';
    }
  }

  /// Check if error message indicates an authentication error
  static bool _isAuthenticationError(String message) {
    final lowerMessage = message.toLowerCase();
    
    // Common authentication error patterns
    final authPatterns = [
      'credential',
      'password',
      'username',
      'login',
      'authentication',
      'unauthorized',
      'invalid email',
      'invalid password',
      'wrong password',
      'incorrect password',
      'user not found',
      'invalid user',
      'auth failed',
      'authentication failed',
      'invalid login',
    ];
    
    return authPatterns.any((pattern) => lowerMessage.contains(pattern));
  }

  /// Handle unknown Dio errors with user-friendly messages
  static ErrorResponse _handleUnknownError(DioException error) {
    if (error.message != null) {
      final message = error.message!.toLowerCase();
      
      if (message.contains('socketexception') ||
          message.contains('network is unreachable')) {
        return ErrorResponse(
          code: 'NETWORK_ERROR',
          message: 'Network error. Please check your internet connection.',
          status: 0,
        );
      }
      
      if (message.contains('failed host lookup')) {
        return ErrorResponse(
          code: 'DNS_ERROR',
          message: 'Cannot reach server. Please check your connection.',
          status: 0,
        );
      }
      
      if (message.contains('software caused connection abort')) {
        return ErrorResponse(
          code: 'CONNECTION_ABORTED',
          message: 'Connection was interrupted. Please try again.',
          status: 0,
        );
      }
    }
    
    return ErrorResponse(
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      status: 0,
      details: error.message,
    );
  }

  /// Get error type for analytics/logging
  static String getErrorType(dynamic error) {
    if (error is DioException) {
      switch (error.type) {
        case DioExceptionType.connectionTimeout:
          return 'CONNECTION_TIMEOUT';
        case DioExceptionType.sendTimeout:
          return 'SEND_TIMEOUT';
        case DioExceptionType.receiveTimeout:
          return 'RECEIVE_TIMEOUT';
        case DioExceptionType.badResponse:
          return 'BAD_RESPONSE_${error.response?.statusCode}';
        case DioExceptionType.connectionError:
          return 'CONNECTION_ERROR';
        case DioExceptionType.cancel:
          return 'CANCELLED';
        case DioExceptionType.badCertificate:
          return 'BAD_CERTIFICATE';
        case DioExceptionType.unknown:
          return 'UNKNOWN_ERROR';
      }
    }
    
    final errorResponse = parseError(error);
    return errorResponse.code;
  }

  /// Check if error is recoverable (user can retry)
  static bool isRecoverable(dynamic error) {
    if (error is DioException) {
      switch (error.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
        case DioExceptionType.connectionError:
          return true;
        case DioExceptionType.badResponse:
          final statusCode = error.response?.statusCode;
          // 5xx errors are typically recoverable
          return statusCode != null && statusCode >= 500;
        default:
          return false;
      }
    }
    
    final errorResponse = parseError(error);
    // 5xx and network errors are recoverable
    return errorResponse.status >= 500 || errorResponse.status == 0;
  }

  /// Get error code from error
  static String getErrorCode(dynamic error) {
    final errorResponse = parseError(error);
    return errorResponse.code;
  }

  /// Get error details for support/debugging
  static String getDetailedError(dynamic error) {
    final errorResponse = parseError(error);
    return errorResponse.detailedMessage;
  }
}
