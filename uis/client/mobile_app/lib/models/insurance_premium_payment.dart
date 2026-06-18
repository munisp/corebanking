class InsurancePremiumPayment {
  final String id;
  final String policyId;
  final String userId;
  final double amount;
  final String paymentMethod;
  final String status;
  final DateTime paymentDate;
  final DateTime? nextPaymentDate;
  final String? transactionReference;
  final DateTime createdAt;

  InsurancePremiumPayment({
    required this.id,
    required this.policyId,
    required this.userId,
    required this.amount,
    required this.paymentMethod,
    required this.status,
    required this.paymentDate,
    this.nextPaymentDate,
    this.transactionReference,
    required this.createdAt,
  });

  factory InsurancePremiumPayment.fromJson(Map<String, dynamic> json) {
    return InsurancePremiumPayment(
      id: json['id'] ?? json['payment_id'] ?? '',
      policyId: json['policy_id'] ?? json['policyId'] ?? '',
      userId: json['user_id'] ?? json['userId'] ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      paymentMethod: json['payment_method'] ?? json['paymentMethod'] ?? '',
      status: json['status'] ?? 'completed',
      paymentDate: json['payment_date'] != null
          ? DateTime.parse(json['payment_date'])
          : DateTime.now(),
      nextPaymentDate: json['next_payment_date'] != null
          ? DateTime.parse(json['next_payment_date'])
          : null,
      transactionReference: json['transaction_reference'] ?? json['transactionReference'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'policy_id': policyId,
      'user_id': userId,
      'amount': amount,
      'payment_method': paymentMethod,
      'status': status,
      'payment_date': paymentDate.toIso8601String(),
      'next_payment_date': nextPaymentDate?.toIso8601String(),
      'transaction_reference': transactionReference,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
