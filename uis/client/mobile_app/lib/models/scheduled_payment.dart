class ScheduledPayment {
  final String id;
  final String userId;
  final String accountId;
  final String recipientName;
  final String recipientAccount;
  final String recipientBank;
  final double amount;
  final String frequency; // once, daily, weekly, monthly, yearly
  final DateTime startDate;
  final DateTime? endDate;
  final String? description;
  final String status; // active, paused, completed, cancelled
  final DateTime? lastExecutionDate;
  final DateTime? nextExecutionDate;
  final int executionCount;
  final int? maxExecutions;
  final DateTime createdAt;

  ScheduledPayment({
    required this.id,
    required this.userId,
    required this.accountId,
    required this.recipientName,
    required this.recipientAccount,
    required this.recipientBank,
    required this.amount,
    required this.frequency,
    required this.startDate,
    this.endDate,
    this.description,
    required this.status,
    this.lastExecutionDate,
    this.nextExecutionDate,
    required this.executionCount,
    this.maxExecutions,
    required this.createdAt,
  });

  factory ScheduledPayment.fromJson(Map<String, dynamic> json) {
    return ScheduledPayment(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? '',
      accountId: json['account_id'] ?? '',
      recipientName: json['recipient_name'] ?? '',
      recipientAccount: json['recipient_account'] ?? '',
      recipientBank: json['recipient_bank'] ?? '',
      amount: (json['amount'] ?? 0.0).toDouble(),
      frequency: json['frequency'] ?? 'once',
      startDate: json['start_date'] != null
          ? DateTime.parse(json['start_date'])
          : DateTime.now(),
      endDate: json['end_date'] != null
          ? DateTime.parse(json['end_date'])
          : null,
      description: json['description'],
      status: json['status'] ?? 'active',
      lastExecutionDate: json['last_execution_date'] != null
          ? DateTime.parse(json['last_execution_date'])
          : null,
      nextExecutionDate: json['next_execution_date'] != null
          ? DateTime.parse(json['next_execution_date'])
          : null,
      executionCount: json['execution_count'] ?? 0,
      maxExecutions: json['max_executions'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'account_id': accountId,
      'recipient_name': recipientName,
      'recipient_account': recipientAccount,
      'recipient_bank': recipientBank,
      'amount': amount,
      'frequency': frequency,
      'start_date': startDate.toIso8601String(),
      'end_date': endDate?.toIso8601String(),
      'description': description,
      'status': status,
      'last_execution_date': lastExecutionDate?.toIso8601String(),
      'next_execution_date': nextExecutionDate?.toIso8601String(),
      'execution_count': executionCount,
      'max_executions': maxExecutions,
      'created_at': createdAt.toIso8601String(),
    };
  }

  ScheduledPayment copyWith({
    String? id,
    String? userId,
    String? accountId,
    String? recipientName,
    String? recipientAccount,
    String? recipientBank,
    double? amount,
    String? frequency,
    DateTime? startDate,
    DateTime? endDate,
    String? description,
    String? status,
    DateTime? lastExecutionDate,
    DateTime? nextExecutionDate,
    int? executionCount,
    int? maxExecutions,
    DateTime? createdAt,
  }) {
    return ScheduledPayment(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      accountId: accountId ?? this.accountId,
      recipientName: recipientName ?? this.recipientName,
      recipientAccount: recipientAccount ?? this.recipientAccount,
      recipientBank: recipientBank ?? this.recipientBank,
      amount: amount ?? this.amount,
      frequency: frequency ?? this.frequency,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      description: description ?? this.description,
      status: status ?? this.status,
      lastExecutionDate: lastExecutionDate ?? this.lastExecutionDate,
      nextExecutionDate: nextExecutionDate ?? this.nextExecutionDate,
      executionCount: executionCount ?? this.executionCount,
      maxExecutions: maxExecutions ?? this.maxExecutions,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  String get formattedAmount {
    return '₦${amount.toStringAsFixed(2).replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]},',
        )}';
  }

  String get frequencyText {
    switch (frequency) {
      case 'once':
        return 'One Time';
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      case 'monthly':
        return 'Monthly';
      case 'yearly':
        return 'Yearly';
      default:
        return 'Unknown';
    }
  }

  String get statusText {
    switch (status) {
      case 'active':
        return 'Active';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  }
}
