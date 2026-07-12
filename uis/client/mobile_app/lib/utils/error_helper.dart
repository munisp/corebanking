import 'package:flutter/material.dart';
import '../models/error_response.dart';
import '../services/error_handler_service.dart';
import '../widgets/error_snackbar.dart';

/// Utility class for handling errors throughout the application
/// 
/// This helper provides consistent error handling patterns for:
/// - Parsing backend error responses
/// - Displaying user-friendly error messages
/// - Logging errors for debugging
/// 
/// Example usage:
/// ```dart
/// try {
///   final response = await apiService.post('/api/endpoint', data: {...});
///   // ... handle success
/// } catch (e) {
///   ErrorHelper.handleAndShow(context, e);
/// }
/// ```
class ErrorHelper {
  /// Parse error and show it to the user using ErrorSnackbar
  static void handleAndShow(BuildContext context, dynamic error, {
    bool showErrorCode = true,
  }) {
    final errorResponse = ErrorHandlerService.parseError(error);
    
    // Log for debugging
    debugPrint('[Error] ${errorResponse.code}: ${errorResponse.message}');
    if (errorResponse.details != null) {
      debugPrint('[Error Details] ${errorResponse.details}');
    }
    
    // Show to user
    ErrorSnackbar.showError(
      context,
      errorResponse,
      showErrorCode: showErrorCode,
    );
  }

  /// Parse error and return ErrorResponse object
  static ErrorResponse parse(dynamic error) {
    return ErrorHandlerService.parseError(error);
  }

  /// Get user-friendly error message
  static String getMessage(dynamic error) {
    return ErrorHandlerService.handleError(error);
  }

  /// Get error code
  static String getCode(dynamic error) {
    return ErrorHandlerService.getErrorCode(error);
  }

  /// Get detailed error message (for support/debugging)
  static String getDetails(dynamic error) {
    return ErrorHandlerService.getDetailedError(error);
  }

  /// Check if error is recoverable (user can retry)
  static bool isRecoverable(dynamic error) {
    return ErrorHandlerService.isRecoverable(error);
  }

  /// Show error dialog with retry option
  static Future<bool?> showErrorDialog(
    BuildContext context,
    dynamic error, {
    String? title,
    VoidCallback? onRetry,
  }) {
    final errorResponse = ErrorHandlerService.parseError(error);
    final isRetryable = ErrorHandlerService.isRecoverable(error);

    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title ?? 'Error'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(errorResponse.message),
            const SizedBox(height: 8),
            Text(
              'Code: ${errorResponse.code}',
              style: const TextStyle(
                fontSize: 12,
                color: Colors.grey,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Close'),
          ),
          if (isRetryable && onRetry != null)
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop(true);
                onRetry();
              },
              child: const Text('Retry'),
            ),
        ],
      ),
    );
  }
}
