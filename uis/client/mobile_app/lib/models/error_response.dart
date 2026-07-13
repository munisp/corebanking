/// Model for standardized error responses from the backend
class ErrorResponse {
  final String code;
  final String message;
  final int status;
  final dynamic details;

  ErrorResponse({
    required this.code,
    required this.message,
    required this.status,
    this.details,
  });

  /// Create ErrorResponse from JSON
  factory ErrorResponse.fromJson(Map<String, dynamic> json) {
    // Handle nested detail structure: {"detail": {"message": "...", "code": "...", "status": "...", "service": "..."}}
    if (json.containsKey('detail') && json['detail'] is Map) {
      final detail = json['detail'] as Map<String, dynamic>;
      return ErrorResponse(
        code: detail['code']?.toString() ?? 'UNKNOWN_ERROR',
        message: detail['message']?.toString() ?? 'An error occurred',
        status: _parseStatus(detail['status']),
        details: detail,
      );
    }
    
    // Handle standard format
    return ErrorResponse(
      code: json['code']?.toString() ?? 'UNKNOWN_ERROR',
      message: json['message']?.toString() ?? 'An error occurred',
      status: json['status'] ?? 500,
      details: json['details'],
    );
  }

  /// Helper to parse status field (can be "error" string or numeric code)
  static int _parseStatus(dynamic status) {
    if (status == null) return 500;
    if (status is int) return status;
    if (status is String) {
      // If status is "error" or similar, return a default error code
      if (status.toLowerCase() == 'error') return 400;
      // Try to parse as int
      return int.tryParse(status) ?? 500;
    }
    return 500;
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'code': code,
      'message': message,
      'status': status,
      if (details != null) 'details': details,
    };
  }

  /// Get a user-friendly message
  String get userMessage {
    // If details contains a user-friendly message, use it
    if (details != null && details is Map) {
      final detailsMap = details as Map<String, dynamic>;
      if (detailsMap['userMessage'] != null) {
        return detailsMap['userMessage'].toString();
      }
    }
    
    // Otherwise use the main message
    return message;
  }

  /// Get a display message with code for debugging (optional)
  String get displayMessage => message;

  /// Get a detailed message with code and details for support
  String get detailedMessage {
    final buffer = StringBuffer();
    buffer.write(message);
    buffer.write(' (Code: $code)');
    if (details != null && details is Map) {
      final detailsMap = details as Map<String, dynamic>;
      // Include service info if available
      if (detailsMap['service'] != null) {
        buffer.write('\nService: ${detailsMap['service']}');
      }
      // Include any other details
      final otherDetails = Map<String, dynamic>.from(detailsMap);
      otherDetails.remove('message');
      otherDetails.remove('code');
      otherDetails.remove('status');
      otherDetails.remove('service');
      if (otherDetails.isNotEmpty) {
        buffer.write('\nDetails: $otherDetails');
      }
    } else if (details != null && details.toString().isNotEmpty) {
      buffer.write('\nDetails: $details');
    }
    return buffer.toString();
  }

  @override
  String toString() => 'ErrorResponse(code: $code, message: $message, status: $status)';
}
