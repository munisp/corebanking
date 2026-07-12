class EnairaWallet {
  final String id;
  final String walletRef;
  final String customerId;
  final String walletAddress;
  final String tier;
  final double balance;
  final String currency;
  final String status;
  final String createdAt;
  final String? updatedAt;

  EnairaWallet({
    required this.id,
    required this.walletRef,
    required this.customerId,
    required this.walletAddress,
    required this.tier,
    required this.balance,
    this.currency = 'eNGN',
    required this.status,
    required this.createdAt,
    this.updatedAt,
  });

  factory EnairaWallet.fromJson(Map<String, dynamic> json) {
    return EnairaWallet(
      id: (json['id'] ?? '').toString(),
      walletRef: (json['wallet_ref'] ?? json['walletRef'] ?? '').toString(),
      customerId: (json['customer_id'] ?? json['customerId'] ?? '').toString(),
      walletAddress: (json['wallet_address'] ?? json['walletAddress'] ?? '').toString(),
      tier: (json['tier'] ?? 'Tier 1').toString(),
      balance: (json['balance'] ?? 0).toDouble(),
      currency: (json['currency'] ?? 'eNGN').toString(),
      status: (json['status'] ?? 'active').toString(),
      createdAt: (json['created_at'] ?? json['createdAt'] ?? '').toString(),
      updatedAt: json['updated_at']?.toString() ?? json['updatedAt']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'wallet_ref': walletRef,
        'customer_id': customerId,
        'wallet_address': walletAddress,
        'tier': tier,
        'balance': balance,
        'currency': currency,
        'status': status,
        'created_at': createdAt,
        if (updatedAt != null) 'updated_at': updatedAt,
      };

  String get formattedBalance => '$currency ${balance.toStringAsFixed(2)}';
}
