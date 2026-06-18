class Wallet {
  final String id;
  final String userId;
  final String accountNumber;
  final double balance;
  final double availableBalance;
  final String currency;
  final String status;
  final DateTime createdAt;
  final DateTime? updatedAt;

  Wallet({
    required this.id,
    required this.userId,
    required this.accountNumber,
    required this.balance,
    required this.availableBalance,
    required this.currency,
    required this.status,
    required this.createdAt,
    this.updatedAt,
  });

  factory Wallet.fromJson(Map<String, dynamic> json) {
    return Wallet(
      id: json['id'] ?? json['wallet_id'] ?? '',
      userId: json['user_id'] ?? json['userId'] ?? '',
      accountNumber: json['account_number'] ?? json['accountNumber'] ?? '',
      balance: (json['balance'] ?? 0).toDouble(),
      availableBalance: (json['available_balance'] ?? json['availableBalance'] ?? 0).toDouble(),
      currency: json['currency'] ?? 'NGN',
      status: json['status'] ?? 'active',
      createdAt: DateTime.parse(json['created_at'] ?? json['createdAt'] ?? DateTime.now().toIso8601String()),
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
      'balance': balance,
      'available_balance': availableBalance,
      'currency': currency,
      'status': status,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  String get formattedBalance {
    return '₦${balance.toStringAsFixed(2).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}';
  }

  String get formattedAvailableBalance {
    return '₦${availableBalance.toStringAsFixed(2).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}';
  }
}
