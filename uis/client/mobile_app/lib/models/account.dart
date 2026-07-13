class BankAccount {
  final String id;
  final String userId;
  final String accountNumber;
  final String accountType;
  final String accountName;
  final double balance;
  final String currency;
  final bool isPrimary;
  final String status;
  final DateTime createdAt;
  final DateTime? updatedAt;

  BankAccount({
    required this.id,
    required this.userId,
    required this.accountNumber,
    required this.accountType,
    required this.accountName,
    required this.balance,
    this.currency = 'NGN',
    this.isPrimary = false,
    this.status = 'active',
    required this.createdAt,
    this.updatedAt,
  });

  String get formattedBalance {
    final currencySymbol = currency == 'NGN' ? '₦' : currency;
    return '$currencySymbol${balance.toStringAsFixed(2)}';
  }

  factory BankAccount.fromJson(Map<String, dynamic> json) {
    return BankAccount(
      id: (json['id'] ?? '').toString(),
      userId: (json['user_id'] ?? json['userId'] ?? '').toString(),
      accountNumber: json['account_number'] ?? json['accountNumber'] ?? '',
      accountType: json['account_type'] ?? json['accountType'] ?? 'savings',
      accountName: json['account_name'] ?? json['accountName'] ?? '',
      balance: (json['balance'] ?? 0).toDouble(),
      currency: json['currency'] ?? 'NGN',
      isPrimary: json['is_primary'] ?? json['isPrimary'] ?? false,
      status: json['status'] ?? 'active',
      createdAt: DateTime.parse(
        json['created_at'] ?? json['createdAt'] ?? DateTime.now().toIso8601String(),
      ),
      updatedAt: json['updated_at'] != null || json['updatedAt'] != null
          ? DateTime.parse(json['updated_at'] ?? json['updatedAt'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'account_number': accountNumber,
      'account_type': accountType,
      'account_name': accountName,
      'balance': balance,
      'currency': currency,
      'is_primary': isPrimary,
      'status': status,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  BankAccount copyWith({
    String? id,
    String? userId,
    String? accountNumber,
    String? accountType,
    String? accountName,
    double? balance,
    String? currency,
    bool? isPrimary,
    String? status,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return BankAccount(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      accountNumber: accountNumber ?? this.accountNumber,
      accountType: accountType ?? this.accountType,
      accountName: accountName ?? this.accountName,
      balance: balance ?? this.balance,
      currency: currency ?? this.currency,
      isPrimary: isPrimary ?? this.isPrimary,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
