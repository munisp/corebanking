import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../config/app_theme.dart';
import '../models/error_response.dart';

/// A reusable utility for showing error messages with click-to-copy functionality
class ErrorSnackbar {
  /// Show a structured error response with click-to-copy functionality
  static void showError(
    BuildContext context,
    dynamic error, {
    Duration duration = const Duration(seconds: 4),
    Color? backgroundColor,
    bool showErrorCode = true,
  }) {
    // Parse error if it's an ErrorResponse
    String message;
    String? errorCode;
    String detailedMessage;

    if (error is ErrorResponse) {
      message = error.userMessage;
      errorCode = showErrorCode ? error.code : null;
      detailedMessage = error.detailedMessage;
    } else if (error is String) {
      message = error;
      detailedMessage = error;
    } else {
      message = error.toString();
      detailedMessage = error.toString();
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: InkWell(
          onTap: () {
            Clipboard.setData(ClipboardData(text: detailedMessage));
            ScaffoldMessenger.of(context).hideCurrentSnackBar();
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Row(
                  children: [
                    Icon(Icons.check_circle, color: Colors.white, size: 20),
                    SizedBox(width: 12),
                    Text('Error details copied to clipboard'),
                  ],
                ),
                duration: Duration(seconds: 2),
                backgroundColor: Colors.green,
                behavior: SnackBarBehavior.floating,
              ),
            );
          },
          child: Row(
            children: [
              const Icon(Icons.error_outline, color: Colors.white),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      message,
                      style: const TextStyle(color: Colors.white),
                    ),
                    if (errorCode != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Code: $errorCode',
                        style: const TextStyle(
                          color: Colors.white60,
                          fontSize: 11,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                    const SizedBox(height: 4),
                    const Text(
                      'Tap to copy details',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.content_copy, color: Colors.white70, size: 18),
            ],
          ),
        ),
        backgroundColor: backgroundColor ?? AppTheme.errorColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
        duration: duration,
      ),
    );
  }

  /// Show an error message with click-to-copy functionality (legacy method)
  static void show(
    BuildContext context,
    String message, {
    Duration duration = const Duration(seconds: 4),
    Color? backgroundColor,
  }) {
    showError(
      context,
      message,
      duration: duration,
      backgroundColor: backgroundColor,
      showErrorCode: false,
    );
  }

  /// Show a simple success message
  static void showSuccess(
    BuildContext context,
    String message, {
    Duration duration = const Duration(seconds: 3),
  }) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(color: Colors.white),
              ),
            ),
          ],
        ),
        backgroundColor: AppTheme.successColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
        duration: duration,
      ),
    );
  }

  /// Show an info message
  static void showInfo(
    BuildContext context,
    String message, {
    Duration duration = const Duration(seconds: 3),
  }) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.info_outline, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(color: Colors.white),
              ),
            ),
          ],
        ),
        backgroundColor: Colors.blue,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
        duration: duration,
      ),
    );
  }

  /// Show a warning message
  static void showWarning(
    BuildContext context,
    String message, {
    Duration duration = const Duration(seconds: 3),
  }) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.warning_amber, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(color: Colors.white),
              ),
            ),
          ],
        ),
        backgroundColor: AppTheme.warningColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
        duration: duration,
      ),
    );
  }
}
