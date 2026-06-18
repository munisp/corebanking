import 'dart:convert';

class Dispute {
  final String id;
  final String userId;
  final String transactionId;
  final String category; // unauthorized_transaction, incorrect_amount, service_not_received, duplicate_charge, other
  final String subject;
  final String description;
  final double disputedAmount;
  final String status; // pending, under_review, resolved, rejected, escalated
  final String priority; // low, medium, high
  final String? resolutionNotes;
  final DateTime? resolvedAt;
  final List<String> attachments;
  final DateTime createdAt;
  final DateTime? updatedAt;

  Dispute({
    required this.id,
    required this.userId,
    required this.transactionId,
    required this.category,
    required this.subject,
    required this.description,
    required this.disputedAmount,
    required this.status,
    required this.priority,
    this.resolutionNotes,
    this.resolvedAt,
    required this.attachments,
    required this.createdAt,
    this.updatedAt,
  });

  bool get isPending => status.toLowerCase() == 'pending';
  bool get isUnderReview => status.toLowerCase() == 'under_review';
  bool get isResolved => status.toLowerCase() == 'resolved';
  bool get isRejected => status.toLowerCase() == 'rejected';
  bool get isEscalated => status.toLowerCase() == 'escalated';

  String get statusDisplay {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'Pending';
      case 'under_review':
        return 'Under Review';
      case 'resolved':
        return 'Resolved';
      case 'rejected':
        return 'Rejected';
      case 'escalated':
        return 'Escalated';
      default:
        return status;
    }
  }

  String get categoryDisplay {
    switch (category.toLowerCase()) {
      case 'unauthorized_transaction':
        return 'Unauthorized Transaction';
      case 'incorrect_amount':
        return 'Incorrect Amount';
      case 'service_not_received':
        return 'Service Not Received';
      case 'duplicate_charge':
        return 'Duplicate Charge';
      case 'other':
        return 'Other';
      default:
        return category;
    }
  }

  factory Dispute.fromJson(Map<String, dynamic> json) {
    // Helper function to safely parse numeric values (handles both int and string)
    double parseDouble(dynamic value, [double defaultValue = 0.0]) {
      if (value == null) return defaultValue;
      if (value is double) return value;
      if (value is int) return value.toDouble();
      if (value is String) {
        return double.tryParse(value) ?? defaultValue;
      }
      return defaultValue;
    }

    // Helper function to safely parse DateTime
    DateTime parseDateTime(dynamic value, [DateTime? defaultValue]) {
      if (value == null) return defaultValue ?? DateTime.now();
      if (value is DateTime) return value;
      if (value is String) {
        try {
          // Try ISO 8601 format first
          if (value.contains('T') || value.contains('Z')) {
            return DateTime.parse(value);
          }
          // Try SQL datetime format: "2025-12-19 16:10:48"
          if (value.contains(' ')) {
            return DateTime.parse(value.replaceAll(' ', 'T'));
          }
          // Try date format: "2026-01-18"
          if (value.length == 10 && value.contains('-')) {
            return DateTime.parse('${value}T00:00:00');
          }
          // Try standard parse
          return DateTime.parse(value);
        } catch (e) {
          return defaultValue ?? DateTime.now();
        }
      }
      return defaultValue ?? DateTime.now();
    }

    // Helper to safely parse list of strings
    List<String> parseStringList(dynamic value) {
      if (value == null) return [];
      if (value is List) {
        return value.map((e) => e.toString()).toList();
      }
      if (value is String) {
        // Try to parse JSON string
        try {
          final parsed = jsonDecode(value);
          if (parsed is List) {
            return parsed.map((e) => e.toString()).toList();
          }
        } catch (e) {
          // If parsing fails, return empty list
        }
      }
      return [];
    }

    return Dispute(
      id: (json['id'] ?? json['dispute_id'] ?? '').toString(),
      userId: (json['user_id'] ?? json['userId'] ?? '').toString(),
      transactionId: (json['transaction_id'] ?? json['transactionId'] ?? '').toString(),
      category: (json['category'] ?? 'other').toString(),
      subject: (json['subject'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      disputedAmount: parseDouble(json['disputed_amount'] ?? json['disputedAmount']),
      status: (json['status'] ?? 'pending').toString(),
      priority: (json['priority'] ?? 'medium').toString(),
      resolutionNotes: json['resolution_notes'] != null || json['resolutionNotes'] != null
          ? (json['resolution_notes'] ?? json['resolutionNotes']).toString()
          : null,
      resolvedAt: json['resolved_at'] != null || json['resolvedAt'] != null
          ? parseDateTime(json['resolved_at'] ?? json['resolvedAt'])
          : null,
      attachments: parseStringList(json['attachments']),
      createdAt: parseDateTime(json['created_at'] ?? json['createdAt']),
      updatedAt: json['updated_at'] != null || json['updatedAt'] != null
          ? parseDateTime(json['updated_at'] ?? json['updatedAt'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'transaction_id': transactionId,
      'category': category,
      'subject': subject,
      'description': description,
      'disputed_amount': disputedAmount,
      'status': status,
      'priority': priority,
      'resolution_notes': resolutionNotes,
      'resolved_at': resolvedAt?.toIso8601String(),
      'attachments': attachments,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  Dispute copyWith({
    String? id,
    String? userId,
    String? transactionId,
    String? category,
    String? subject,
    String? description,
    double? disputedAmount,
    String? status,
    String? priority,
    String? resolutionNotes,
    DateTime? resolvedAt,
    List<String>? attachments,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Dispute(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      transactionId: transactionId ?? this.transactionId,
      category: category ?? this.category,
      subject: subject ?? this.subject,
      description: description ?? this.description,
      disputedAmount: disputedAmount ?? this.disputedAmount,
      status: status ?? this.status,
      priority: priority ?? this.priority,
      resolutionNotes: resolutionNotes ?? this.resolutionNotes,
      resolvedAt: resolvedAt ?? this.resolvedAt,
      attachments: attachments ?? this.attachments,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
