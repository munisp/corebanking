class BNPLApplication {
  final String applicationId;
  final String tenantId;
  final String applicantId;
  final String merchantId;
  final double purchaseAmount;
  final int installmentCount;
  final double installmentAmount;
  final double interestRate;
  final String productDescription;
  final String status;
  final int creditScore;
  final bool bvnVerified;
  final DateTime createdAt;
  final DateTime updatedAt;

  BNPLApplication({
    this.applicationId = '',
    this.tenantId = '',
    this.applicantId = '',
    this.merchantId = '',
    this.purchaseAmount = 0.0,
    this.installmentCount = 1,
    this.installmentAmount = 0.0,
    this.interestRate = 0.0,
    this.productDescription = '',
    this.status = 'pending',
    this.creditScore = 0,
    this.bvnVerified = false,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  factory BNPLApplication.fromJson(Map<String, dynamic> json) {
    return BNPLApplication(
      applicationId: json['application_id'] as String? ?? '',
      tenantId: json['tenant_id'] as String? ?? '',
      applicantId: json['applicant_id'] as String? ?? '',
      merchantId: json['merchant_id'] as String? ?? '',
      purchaseAmount: (json['purchase_amount'] as num?)?.toDouble() ?? 0.0,
      installmentCount: json['installment_count'] as int? ?? 1,
      installmentAmount: (json['installment_amount'] as num?)?.toDouble() ?? 0.0,
      interestRate: (json['interest_rate'] as num?)?.toDouble() ?? 0.0,
      productDescription: json['product_description'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      creditScore: json['credit_score'] as int? ?? 0,
      bvnVerified: json['bvn_verified'] as bool? ?? false,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String) ?? DateTime.now()
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}
