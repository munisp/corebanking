class CarbonTrade {
  final String id;
  final String userId;
  final String projectId;
  final String creditId;
  final String tradeType; // 'buy' or 'sell'
  final int quantity;
  final double pricePerCredit;
  final double totalAmount;
  final String status;
  final DateTime tradeDate;
  final Map<String, dynamic>? metadata;

  CarbonTrade({
    required this.id,
    required this.userId,
    required this.projectId,
    required this.creditId,
    required this.tradeType,
    required this.quantity,
    required this.pricePerCredit,
    required this.totalAmount,
    required this.status,
    required this.tradeDate,
    this.metadata,
  });

  factory CarbonTrade.fromJson(Map<String, dynamic> json) {
    return CarbonTrade(
      id: json['id'] ?? json['trade_id'] ?? '',
      userId: json['user_id'] ?? json['userId'] ?? '',
      projectId: json['project_id'] ?? json['projectId'] ?? '',
      creditId: json['credit_id'] ?? json['creditId'] ?? '',
      tradeType: json['trade_type'] ?? json['tradeType'] ?? 'buy',
      quantity: json['quantity'] ?? 0,
      pricePerCredit: (json['price_per_credit'] ?? json['pricePerCredit'] ?? 0).toDouble(),
      totalAmount: (json['total_amount'] ?? json['totalAmount'] ?? 0).toDouble(),
      status: json['status'] ?? 'completed',
      tradeDate: json['trade_date'] != null 
          ? DateTime.parse(json['trade_date']) 
          : DateTime.now(),
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'project_id': projectId,
      'credit_id': creditId,
      'trade_type': tradeType,
      'quantity': quantity,
      'price_per_credit': pricePerCredit,
      'total_amount': totalAmount,
      'status': status,
      'trade_date': tradeDate.toIso8601String(),
      'metadata': metadata,
    };
  }
}
