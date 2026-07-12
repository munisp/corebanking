class Savings {
  final String id;
  final String userId;
  final String name;
  final String goal_id; // For compatibility with web app
  final String description;
  final double targetAmount;
  final double currentAmount;
  final String frequency; // daily, weekly, monthly
  final double contributionAmount;
  final DateTime startDate;
  final DateTime? endDate;
  final String status; // active, completed, paused
  final String? imageUrl;
  final DateTime createdAt;
  final DateTime? updatedAt;

  Savings({
    required this.id,
    required this.userId,
    required this.name,
    this.goal_id = '',
    required this.description,
    required this.targetAmount,
    required this.currentAmount,
    required this.frequency,
    required this.contributionAmount,
    required this.startDate,
    this.endDate,
    required this.status,
    this.imageUrl,
    required this.createdAt,
    this.updatedAt,
  });

  double get progress {
    if (targetAmount == 0) return 0;
    return (currentAmount / targetAmount).clamp(0.0, 1.0);
  }

  factory Savings.fromJson(Map<String, dynamic> json) {
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
    // Handles ISO 8601, SQL datetime format (YYYY-MM-DD HH:mm:ss), and date format (YYYY-MM-DD)
    DateTime parseDateTime(dynamic value, [DateTime? defaultValue]) {
      if (value == null) return defaultValue ?? DateTime.now();
      if (value is DateTime) return value;
      if (value is String) {
        try {
          // Try ISO 8601 format first
          if (value.contains('T') || value.contains('Z')) {
            return DateTime.parse(value);
          }
          // Try SQL datetime format: "2025-12-19 03:34:42"
          if (value.contains(' ')) {
            return DateTime.parse(value.replaceAll(' ', 'T'));
          }
          // Try date format: "2026-12-18"
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

    // Get ID from various possible fields
    final id = (json['id'] ?? 
                json['goal_id'] ?? 
                json['savings_id'] ?? 
                json['savings_account_id'] ?? 
                '').toString();

    final goalId = (json['goal_id'] ?? 
                    json['id'] ?? 
                    json['savings_id'] ?? 
                    json['savings_account_id'] ?? 
                    '').toString();
    
    // Get name from various possible fields
    final name = (json['goal_name'] ?? 
                  json['name'] ?? 
                  '').toString();
    
    // Get user ID from various possible fields
    final userId = (json['customer_id'] ?? 
                    json['user_id'] ?? 
                    json['userId'] ?? 
                    json['keycloak_id'] ?? 
                    '').toString();
    
    // Use balance as currentAmount if available
    final currentAmount = parseDouble(
      json['balance'] ?? 
      json['current_amount'] ?? 
      json['currentAmount']
    );
    
    // Target date might be in different formats
    final targetDate = json['target_date'] ?? json['targetDate'];
    
    return Savings(
      id: id,
      userId: userId,
      name: name,
      goal_id: goalId,
      description: (json['description'] ?? '').toString(),
      targetAmount: parseDouble(json['target_amount'] ?? json['targetAmount']),
      currentAmount: currentAmount,
      frequency: (json['frequency'] ?? 'monthly').toString(),
      contributionAmount: parseDouble(json['contribution_amount'] ?? json['contributionAmount']),
      startDate: targetDate != null 
          ? parseDateTime(targetDate)
          : parseDateTime(json['start_date'] ?? json['startDate']),
      endDate: (json['end_date'] != null || json['endDate'] != null)
          ? parseDateTime(json['end_date'] ?? json['endDate'])
          : null,
      status: (json['status'] ?? 'active').toString(),
      imageUrl: json['image_url'] != null || json['imageUrl'] != null
          ? (json['image_url'] ?? json['imageUrl']).toString()
          : null,
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
      'name': name,
      'description': description,
      'target_amount': targetAmount,
      'current_amount': currentAmount,
      'frequency': frequency,
      'contribution_amount': contributionAmount,
      'start_date': startDate.toIso8601String(),
      'end_date': endDate?.toIso8601String(),
      'status': status,
      'image_url': imageUrl,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  Savings copyWith({
    String? id,
    String? userId,
    String? name,
    String? description,
    double? targetAmount,
    double? currentAmount,
    String? frequency,
    double? contributionAmount,
    DateTime? startDate,
    DateTime? endDate,
    String? status,
    String? imageUrl,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Savings(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      goal_id: goal_id ?? this.goal_id, // goal_id is not updatable, so we keep it as is
      description: description ?? this.description,
      targetAmount: targetAmount ?? this.targetAmount,
      currentAmount: currentAmount ?? this.currentAmount,
      frequency: frequency ?? this.frequency,
      contributionAmount: contributionAmount ?? this.contributionAmount,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      status: status ?? this.status,
      imageUrl: imageUrl ?? this.imageUrl,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
