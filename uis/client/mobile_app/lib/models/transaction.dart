class Transaction {
  final String id; // UUID from API
  final String transaction_id; // Numeric transaction ID from API
  final String walletId;
  final String type; // credit, debit
  final String category; // transfer, bill_payment, loan_disbursement, etc.
  final double amount;
  final double balanceBefore;
  final double balanceAfter;
  final String currency;
  final String status; // pending, completed, failed
  final String? reference;
  final String? description;
  final String? recipientName;
  final String? recipientAccount;
  final Map<String, dynamic>? metadata;
  final DateTime createdAt;
  final DateTime? updatedAt;

  Transaction({
    required this.id,
    required this.transaction_id,
    required this.walletId,
    required this.type,
    required this.category,
    required this.amount,
    required this.balanceBefore,
    required this.balanceAfter,
    required this.currency,
    required this.status,
    this.reference,
    this.description,
    this.recipientName,
    this.recipientAccount,
    this.metadata,
    required this.createdAt,
    this.updatedAt,
  });

  factory Transaction.fromJson(Map<String, dynamic> json) {
    // Handle API response structure: {id, transaction_id, amount, created_at, status, currency, note, payer, payee, etc.}
    // Determine type based on payer/payee if not provided (matching web app logic)
    String? type = json['type'];
    String? payer = json['payer']?.toString();
    String? payee = json['payee']?.toString();
    
    // If type not provided, determine from payer/payee (matching web app)
    // Note: This will be determined in the service/screen based on user's account_id
    type ??= 'debit';
    
    // Parse created_at date (handle format "2025-12-18 15:48:26")
    DateTime createdAt;
    try {
      final createdAtStr = json['created_at'] ?? json['createdAt'] ?? DateTime.now().toIso8601String();
      createdAt = DateTime.parse(createdAtStr.replaceAll(' ', 'T'));
      if (createdAt.isAfter(DateTime.now().add(const Duration(days: 1)))) {
        createdAt = DateTime.now();
      }
    } catch (e) {
      createdAt = DateTime.now();
    }
    
    return Transaction(
      id: json['id']?.toString() ?? '',
      transaction_id: json['transaction_id']?.toString() ?? json['id']?.toString() ?? '',
      walletId: json['wallet_id'] ?? json['walletId'] ?? json['ledger_id']?.toString() ?? '',
      type: type,
      category: json['category'] ?? (json['note'] != null ? 'transfer' : 'transaction'),
      amount: (json['amount'] is String ? double.tryParse(json['amount']) : json['amount'] ?? 0).toDouble(),
      balanceBefore: (json['balance_before'] ?? json['balanceBefore'] ?? 0).toDouble(),
      balanceAfter: (json['balance_after'] ?? json['balanceAfter'] ?? 0).toDouble(),
      currency: json['currency'] ?? 'NGN',
      status: (json['status'] == 'success' || json['status'] == 'completed') 
          ? 'completed' 
          : (json['status'] == 'pending' || json['status'] == 'failed') 
              ? json['status'] 
              : 'pending',
      reference: json['reference'] ?? json['transaction_id'] ?? json['id'],
      description: json['description'] ?? json['note'] ?? 'Transaction',
      recipientName: json['recipient_name'] ?? json['recipientName'],
      recipientAccount: json['recipient_account'] ?? json['recipientAccount'] ?? payee,
      metadata: json['metadata'] != null ? Map<String, dynamic>.from(json['metadata']) : {
        'payer': payer,
        'payee': payee,
      },
      createdAt: createdAt,
      updatedAt: json['updated_at'] != null || json['updatedAt'] != null
          ? DateTime.parse((json['updated_at'] ?? json['updatedAt']).toString().replaceAll(' ', 'T'))
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'transaction_id': transaction_id,
      'wallet_id': walletId,
      'type': type,
      'category': category,
      'amount': amount,
      'balance_before': balanceBefore,
      'balance_after': balanceAfter,
      'currency': currency,
      'status': status,
      'reference': reference,
      'description': description,
      'recipient_name': recipientName,
      'recipient_account': recipientAccount,
      'metadata': metadata,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  String get formattedAmount {
    final sign = type == 'credit' ? '+' : '-';
    return '$sign₦${amount.toStringAsFixed(2).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}';
  }

  String get displayTitle {
    if (recipientName != null && recipientName!.isNotEmpty) {
      return recipientName!;
    }
    return category.replaceAll('_', ' ').split(' ').map((word) => word[0].toUpperCase() + word.substring(1)).join(' ');
  }

  bool get isCredit => type == 'credit';
  bool get isDebit => type == 'debit';
  bool get isPending => status == 'pending';
  bool get isCompleted => status == 'completed';
  bool get isFailed => status == 'failed';
}