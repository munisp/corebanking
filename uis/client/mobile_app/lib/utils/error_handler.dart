import 'dart:io';

/// ==================== EXCEPTION HIERARCHY ====================

abstract class AppException implements Exception {
  final String message;
  final String? code;
  final dynamic originalError;

  AppException(
    this.message, {
    this.code,
    this.originalError,
  });

  @override
  String toString() => message;

  String get displayMessage => message;

  bool get isNetworkError => false;

  bool get isAuthError => false;

  bool get isValidationError => false;

  bool get isServerError => false;

  bool get isOfflineError => false;
}

/// Network & Connectivity Exceptions
class NetworkException extends AppException {
  NetworkException(String message, {String? code}) : super(message, code: code ?? 'NETWORK_ERROR');

  @override
  bool get isNetworkError => true;

  @override
  String get displayMessage => 'Network connection failed. Please check your connection.';
}

class TimeoutException extends AppException {
  TimeoutException(String message) : super(message, code: 'TIMEOUT');

  @override
  bool get isNetworkError => true;

  @override
  String get displayMessage => 'Request timed out. Please try again.';
}

class OfflineException extends AppException {
  OfflineException(String message) : super(message, code: 'OFFLINE');

  @override
  bool get isOfflineError => true;

  @override
  String get displayMessage => 'You are offline. Please check your connection.';
}

/// API & Server Exceptions
class ApiException extends AppException {
  final int statusCode;
  final Map<String, dynamic>? responseBody;

  ApiException(
    String message, {
    required this.statusCode,
    this.responseBody,
    String? code,
  }) : super(message, code: code ?? 'API_ERROR');

  @override
  bool get isServerError => statusCode >= 500;

  @override
  String get displayMessage {
    if (statusCode == 400) return 'Invalid request. Please check your information.';
    if (statusCode == 401 || statusCode == 403) return 'You don\'t have permission for this action.';
    if (statusCode == 404) return 'The requested resource was not found.';
    if (statusCode >= 500) return 'Server error. Please try again later.';
    return message;
  }
}

/// Authentication Exceptions
class AuthenticationException extends AppException {
  AuthenticationException(String message) : super(message, code: 'AUTH_ERROR');

  @override
  bool get isAuthError => true;

  @override
  String get displayMessage => 'Authentication failed. Please log in again.';
}

class SessionExpiredException extends AppException {
  SessionExpiredException() : super('Session expired', code: 'SESSION_EXPIRED');

  @override
  bool get isAuthError => true;

  @override
  String get displayMessage => 'Your session has expired. Please log in again.';
}

class UnauthorizedException extends AppException {
  UnauthorizedException(String message) : super(message, code: 'UNAUTHORIZED');

  @override
  bool get isAuthError => true;

  @override
  String get displayMessage => 'You don\'t have permission to perform this action.';
}

/// Validation Exceptions
class ValidationException extends AppException {
  final Map<String, List<String>> errors;

  ValidationException(
    String message, {
    required this.errors,
  }) : super(message, code: 'VALIDATION_ERROR');

  @override
  bool get isValidationError => true;

  @override
  String get displayMessage {
    final firstError = errors.values.firstOrNull?.firstOrNull;
    return firstError ?? 'Please check your input and try again.';
  }
}

class FieldValidationException extends AppException {
  final String field;
  final String fieldError;

  FieldValidationException({
    required this.field,
    required this.fieldError,
  }) : super('Validation error on $field', code: 'FIELD_VALIDATION_ERROR');

  @override
  bool get isValidationError => true;

  @override
  String get displayMessage => fieldError;
}

/// Business Logic Exceptions
class InsufficientBalanceException extends AppException {
  final double requiredAmount;
  final double currentBalance;

  InsufficientBalanceException({
    required this.requiredAmount,
    required this.currentBalance,
  }) : super('Insufficient balance', code: 'INSUFFICIENT_BALANCE');

  @override
  String get displayMessage =>
      'Insufficient balance. Required: ${requiredAmount.toStringAsFixed(2)}, Available: ${currentBalance.toStringAsFixed(2)}';
}

class DuplicateResourceException extends AppException {
  DuplicateResourceException(String resource)
      : super('$resource already exists', code: 'DUPLICATE_RESOURCE');

  @override
  String get displayMessage => 'This resource already exists. Please use a different one.';
}

class ResourceNotFoundException extends AppException {
  ResourceNotFoundException(String resource)
      : super('$resource not found', code: 'NOT_FOUND');

  @override
  String get displayMessage => 'The requested resource was not found.';
}

/// Data Parsing Exceptions
class ParsingException extends AppException {
  ParsingException(String message) : super(message, code: 'PARSING_ERROR');

  @override
  String get displayMessage => 'Failed to process data. Please try again.';
}

class JsonSerializationException extends AppException {
  final Type type;

  JsonSerializationException({
    required this.type,
    required String rawData,
  }) : super('Failed to serialize $type from JSON', code: 'JSON_SERIALIZATION_ERROR');

  @override
  String get displayMessage => 'Failed to process response data.';
}

/// Generic Exception
class GenericException extends AppException {
  GenericException(String message) : super(message, code: 'GENERIC_ERROR');

  @override
  String get displayMessage => message;
}

/// ==================== ERROR HANDLER UTILITY ====================

class ErrorHandler {
  static AppException handle(dynamic error) {
    // Handle AppException directly
    if (error is AppException) {
      return error;
    }

    // Handle DioException
    if (error.runtimeType.toString().contains('DioException')) {
      return _handleDioError(error);
    }

    // Handle common exceptions
    if (error is TimeoutException) {
      return TimeoutException(error.message);
    }

    if (error is SocketException) {
      return NetworkException('Network connection failed');
    }

    if (error is FormatException) {
      return ParsingException('Invalid data format: ${error.message}');
    }

    // Default
    return GenericException(
      error.toString().isNotEmpty ? error.toString() : 'An unexpected error occurred',
    );
  }

  static AppException _handleDioError(dynamic error) {
    final message = error.message ?? 'Unknown error';
    final statusCode = error.response?.statusCode ?? 0;
    final responseData = error.response?.data;

    // Handle offline
    if (error.type.toString() == 'DioExceptionType.connectionTimeout' ||
        error.type.toString() == 'DioExceptionType.unknown') {
      return OfflineException('Unable to connect. Please check your internet connection.');
    }

    // Handle timeout
    if (error.type.toString() == 'DioExceptionType.receiveTimeout' ||
        error.type.toString() == 'DioExceptionType.sendTimeout') {
      return TimeoutException('Request timed out. Please try again.');
    }

    // Handle HTTP errors
    if (statusCode != 0) {
      String errorMessage = message;

      // Try to extract error message from response
      if (responseData is Map<String, dynamic>) {
        errorMessage =
            responseData['message'] ?? responseData['error'] ?? errorMessage;

        // Handle validation errors
        if (statusCode == 422 && responseData.containsKey('errors')) {
          final errors = responseData['errors'] as Map<String, dynamic>;
          return ValidationException(errorMessage, errors: Map.from(errors));
        }
      }

      return ApiException(
        errorMessage,
        statusCode: statusCode,
        responseBody: responseData is Map<String, dynamic> ? responseData : null,
      );
    }

    return NetworkException(message);
  }

  static String getErrorMessage(AppException error) {
    return error.displayMessage;
  }

  static bool isRetryable(AppException error) {
    return error is NetworkException ||
        error is TimeoutException ||
        (error is ApiException && error.statusCode >= 500);
  }
}

/// ==================== FORM VALIDATION UTILITY ====================

typedef ValidationRule = String? Function(dynamic);

class FormValidators {
  // Basic field validators
  static String? required(dynamic value, {String fieldName = 'Field'}) {
    if (value == null || (value is String && value.isEmpty)) {
      return '$fieldName is required';
    }
    return null;
  }

  static String? email(dynamic value, {String fieldName = 'Email'}) {
    if (value == null || (value is String && value.isEmpty)) {
      return null;
    }
    const pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
    if (!RegExp(pattern).hasMatch(value.toString())) {
      return '$fieldName is invalid';
    }
    return null;
  }

  static String? phone(dynamic value, {String fieldName = 'Phone'}) {
    if (value == null || (value is String && value.isEmpty)) {
      return null;
    }
    // Nigerian phone number: +234 or 0 followed by 10 digits
    const pattern = r'^(\+234|0)[1-9][0-9]{9}$';
    if (!RegExp(pattern).hasMatch(value.toString().replaceAll(' ', ''))) {
      return '$fieldName must be a valid Nigerian phone number';
    }
    return null;
  }

  static String? Function(dynamic) minLength(int min) {
    return (dynamic value) {
      if (value == null || (value is String && value.isEmpty)) {
        return null;
      }
      if (value.toString().length < min) {
        return 'Must be at least $min characters';
      }
      return null;
    };
  }

  static String? Function(dynamic) maxLength(int max) {
    return (dynamic value) {
      if (value == null || (value is String && value.isEmpty)) {
        return null;
      }
      if (value.toString().length > max) {
        return 'Must not exceed $max characters';
      }
      return null;
    };
  }

  static String? numeric(dynamic value, {String fieldName = 'Field'}) {
    if (value == null || (value is String && value.isEmpty)) {
      return null;
    }
    if (double.tryParse(value.toString()) == null) {
      return '$fieldName must be a number';
    }
    return null;
  }

  static String? Function(dynamic) minValue(double min, {String fieldName = 'Field'}) {
    return (dynamic value) {
      if (value == null || (value is String && value.isEmpty)) {
        return null;
      }
      final numValue = double.tryParse(value.toString());
      if (numValue == null || numValue < min) {
        return '$fieldName must be at least $min';
      }
      return null;
    };
  }

  static String? Function(dynamic) maxValue(double max, {String fieldName = 'Field'}) {
    return (dynamic value) {
      if (value == null || (value is String && value.isEmpty)) {
        return null;
      }
      final numValue = double.tryParse(value.toString());
      if (numValue == null || numValue > max) {
        return '$fieldName must not exceed $max';
      }
      return null;
    };
  }

  // Agricultural-specific validators
  static String? bvn(dynamic value, {String fieldName = 'BVN'}) {
    if (value == null || (value is String && value.isEmpty)) {
      return null;
    }
    if (!RegExp(r'^\d{11}$').hasMatch(value.toString())) {
      return '$fieldName must be exactly 11 digits';
    }
    return null;
  }

  static String? nin(dynamic value, {String fieldName = 'NIN'}) {
    if (value == null || (value is String && value.isEmpty)) {
      return null;
    }
    if (!RegExp(r'^\d{11}$').hasMatch(value.toString())) {
      return '$fieldName must be exactly 11 digits';
    }
    return null;
  }

  static String? farmSize(dynamic value, {String fieldName = 'Farm Size'}) {
    final error = numeric(value, fieldName: fieldName);
    if (error != null) return error;

    if (value != null) {
      final size = double.tryParse(value.toString());
      if (size != null && (size <= 0 || size > 10000)) {
        return '$fieldName must be between 0.1 and 10000 hectares';
      }
    }
    return null;
  }

  static String? loanAmount(dynamic value, {String fieldName = 'Loan Amount'}) {
    final error = numeric(value, fieldName: fieldName);
    if (error != null) return error;

    if (value != null) {
      final amount = double.tryParse(value.toString());
      if (amount != null && (amount <= 0 || amount > 50000000)) {
        return '$fieldName must be between 1,000 and 50,000,000 NGN';
      }
    }
    return null;
  }

  static String? interestRate(dynamic value, {String fieldName = 'Interest Rate'}) {
    final error = numeric(value, fieldName: fieldName);
    if (error != null) return error;

    if (value != null) {
      final rate = double.tryParse(value.toString());
      if (rate != null && (rate < 0 || rate > 100)) {
        return '$fieldName must be between 0% and 100%';
      }
    }
    return null;
  }

  // Combine multiple validators
  static String? combine(dynamic value, List<String? Function(dynamic)> validators) {
    for (final validator in validators) {
      final error = validator(value);
      if (error != null) return error;
    }
    return null;
  }
}

/// ==================== VALIDATION RESULT ====================

class ValidationResult {
  final bool isValid;
  final Map<String, String> errors;

  ValidationResult({
    required this.isValid,
    required this.errors,
  });

  factory ValidationResult.valid() => ValidationResult(
    isValid: true,
    errors: {},
  );

  factory ValidationResult.invalid(Map<String, String> errors) => ValidationResult(
    isValid: false,
    errors: errors,
  );

  String? getError(String field) => errors[field];

  bool hasError(String field) => errors.containsKey(field);
}

/// ==================== FORM FIELD VALIDATOR ====================

class FieldValidator {
  final String _fieldName;
  final List<ValidationRule> _rules = [];

  FieldValidator(this._fieldName);

  FieldValidator required({String? message}) {
    _rules.add((value) {
      if (value == null || (value is String && value.isEmpty)) {
        return message ?? '$_fieldName is required';
      }
      return null;
    });
    return this;
  }

  FieldValidator email({String? message}) {
    _rules.add((value) => FormValidators.email(value, fieldName: _fieldName) ??
        (message != null ? message : null));
    return this;
  }

  FieldValidator phone({String? message}) {
    _rules.add((value) => FormValidators.phone(value, fieldName: _fieldName) ??
        (message != null ? message : null));
    return this;
  }

  FieldValidator minLength(int min, {String? message}) {
    _rules.add((value) => FormValidators.minLength(min)(value) ??
        (message != null ? message : null));
    return this;
  }

  FieldValidator maxLength(int max, {String? message}) {
    _rules.add((value) => FormValidators.maxLength(max)(value) ??
        (message != null ? message : null));
    return this;
  }

  FieldValidator numeric({String? message}) {
    _rules.add((value) => FormValidators.numeric(value, fieldName: _fieldName) ??
        (message != null ? message : null));
    return this;
  }

  FieldValidator minValue(double min, {String? message}) {
    _rules.add((value) => FormValidators.minValue(min, fieldName: _fieldName)(value) ??
        (message != null ? message : null));
    return this;
  }

  FieldValidator custom(String? Function(dynamic) validator) {
    _rules.add(validator);
    return this;
  }

  String? validate(dynamic value) {
    for (final rule in _rules) {
      final error = rule(value);
      if (error != null) return error;
    }
    return null;
  }
}
