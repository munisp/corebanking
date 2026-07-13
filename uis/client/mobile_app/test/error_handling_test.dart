import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/models/error_response.dart';
import 'package:mobile_app/services/error_handler_service.dart';

void main() {
  group('ErrorResponse', () {
    test('should parse structured backend error', () {
      final json = {
        'code': 'ESUSU_4001',
        'message': 'Validation failed',
        'status': 400,
        'details': {'field': 'email'},
      };

      final error = ErrorResponse.fromJson(json);

      expect(error.code, 'ESUSU_4001');
      expect(error.message, 'Validation failed');
      expect(error.status, 400);
      expect(error.details, {'field': 'email'});
    });

    test('should handle missing details', () {
      final json = {
        'code': 'ESUSU_5000',
        'message': 'Server error',
        'status': 500,
      };

      final error = ErrorResponse.fromJson(json);

      expect(error.code, 'ESUSU_5000');
      expect(error.message, 'Server error');
      expect(error.status, 500);
      expect(error.details, isNull);
    });

    test('should provide user-friendly message', () {
      final error = ErrorResponse(
        code: 'ESUSU_4001',
        message: 'Invalid email format',
        status: 400,
      );

      expect(error.userMessage, 'Invalid email format');
      expect(error.displayMessage, 'Invalid email format');
    });

    test('should provide detailed message with code', () {
      final error = ErrorResponse(
        code: 'ESUSU_4001',
        message: 'Invalid email',
        status: 400,
        details: {'field': 'email'},
      );

      final detailed = error.detailedMessage;
      expect(detailed, contains('Invalid email'));
      expect(detailed, contains('ESUSU_4001'));
      expect(detailed, contains('field'));
    });
  });

  group('ErrorHandlerService', () {
    test('should parse structured backend error from map', () {
      final errorData = {
        'code': 'ESUSU_4001',
        'message': 'Bad request',
        'status': 400,
      };

      final error = ErrorHandlerService.parseError(errorData);

      expect(error.code, 'ESUSU_4001');
      expect(error.message, 'Bad request');
      expect(error.status, 400);
    });

    test('should handle legacy error format with message key', () {
      final errorData = {
        'message': 'Something went wrong',
      };

      final error = ErrorHandlerService.parseError(errorData);

      expect(error.message, 'Something went wrong');
      expect(error.code, 'BACKEND_ERROR');
    });

    test('should handle legacy error format with detail key', () {
      final errorData = {
        'detail': 'Not found',
      };

      final error = ErrorHandlerService.parseError(errorData);

      expect(error.message, 'Not found');
    });

    test('should handle validation errors array', () {
      final errorData = {
        'errors': ['Email is required', 'Password too short'],
      };

      final error = ErrorHandlerService.parseError(errorData);

      expect(error.message, 'Email is required');
      expect(error.code, 'VALIDATION_ERROR');
      expect(error.status, 400);
    });

    test('should handle string errors', () {
      final error = ErrorHandlerService.parseError('Simple error message');

      expect(error.message, 'Simple error message');
      expect(error.code, 'BACKEND_ERROR');
    });

    test('should handle null errors', () {
      final error = ErrorHandlerService.parseError(null);

      expect(error.message, 'An error occurred. Please try again.');
      expect(error.code, 'UNKNOWN_ERROR');
    });

    test('should extract error code from error', () {
      final errorData = {
        'code': 'ESUSU_4040',
        'message': 'Not found',
        'status': 404,
      };

      final code = ErrorHandlerService.getErrorCode(errorData);

      expect(code, 'ESUSU_4040');
    });

    test('should get user-friendly message', () {
      final errorData = {
        'code': 'ESUSU_4001',
        'message': 'Invalid input',
        'status': 400,
      };

      final message = ErrorHandlerService.handleError(errorData);

      expect(message, 'Invalid input');
    });

    test('should check if error is recoverable (5xx)', () {
      final errorData = {
        'code': 'ESUSU_5000',
        'message': 'Server error',
        'status': 500,
      };

      final isRecoverable = ErrorHandlerService.isRecoverable(errorData);

      expect(isRecoverable, true);
    });

    test('should check if error is not recoverable (4xx)', () {
      final errorData = {
        'code': 'ESUSU_4001',
        'message': 'Bad request',
        'status': 400,
      };

      final isRecoverable = ErrorHandlerService.isRecoverable(errorData);

      expect(isRecoverable, false);
    });

    test('should handle nested data object', () {
      final errorData = {
        'data': {
          'code': 'ESUSU_4001',
          'message': 'Nested error',
          'status': 400,
        }
      };

      final error = ErrorHandlerService.parseError(errorData);

      expect(error.message, 'Nested error');
      expect(error.code, 'ESUSU_4001');
    });

    test('should provide detailed error for debugging', () {
      final errorData = {
        'code': 'ESUSU_4001',
        'message': 'Validation error',
        'status': 400,
        'details': {'field': 'email', 'reason': 'invalid format'},
      };

      final detailed = ErrorHandlerService.getDetailedError(errorData);

      expect(detailed, contains('Validation error'));
      expect(detailed, contains('ESUSU_4001'));
      expect(detailed, contains('field'));
      expect(detailed, contains('email'));
    });
  });

  group('Error Code Mapping', () {
    test('should recognize ESUSU error codes', () {
      final codes = [
        'ESUSU_4001', // Bad request
        'ESUSU_4040', // Not found
        'ESUSU_5000', // Internal error
        'ESUSU_4002', // Validation failed
        'ESUSU_4003', // Decode error
      ];

      for (final code in codes) {
        final errorData = {
          'code': code,
          'message': 'Test error',
          'status': 400,
        };

        final error = ErrorHandlerService.parseError(errorData);
        expect(error.code, code);
      }
    });
  });
}
