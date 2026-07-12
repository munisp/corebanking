class CarbonCredit {
  final String id;
  final String projectId;
  final String userId;
  final int quantity;
  final double pricePerCredit;
  final double totalAmount;
  final String status;
  final DateTime purchaseDate;
  final DateTime? retirementDate;
  final Map<String, dynamic>? metadata;

  CarbonCredit({
    required this.id,
    required this.projectId,
    required this.userId,
    required this.quantity,
    required this.pricePerCredit,
    required this.totalAmount,
    required this.status,
    required this.purchaseDate,
    this.retirementDate,
    this.metadata,
  });

  factory CarbonCredit.fromJson(Map<String, dynamic> json) {
    return CarbonCredit(
      id: json['id'] ?? json['credit_id'] ?? '',
      projectId: json['project_id'] ?? json['projectId'] ?? '',
      userId: json['user_id'] ?? json['userId'] ?? '',
      quantity: json['quantity'] ?? 0,
      pricePerCredit: (json['price_per_credit'] ?? json['pricePerCredit'] ?? 0).toDouble(),
      totalAmount: (json['total_amount'] ?? json['totalAmount'] ?? 0).toDouble(),
      status: json['status'] ?? 'active',
      purchaseDate: json['purchase_date'] != null 
          ? DateTime.parse(json['purchase_date']) 
          : DateTime.now(),
      retirementDate: json['retirement_date'] != null 
          ? DateTime.parse(json['retirement_date']) 
          : null,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'project_id': projectId,
      'user_id': userId,
      'quantity': quantity,
      'price_per_credit': pricePerCredit,
      'total_amount': totalAmount,
      'status': status,
      'purchase_date': purchaseDate.toIso8601String(),
      'retirement_date': retirementDate?.toIso8601String(),
      'metadata': metadata,
    };
  }
}
