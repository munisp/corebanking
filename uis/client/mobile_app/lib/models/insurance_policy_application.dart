class InsurancePolicyApplication {
  final String? id;
  final String policyType;
  final double coverageAmount;
  final int durationMonths;
  final List<dynamic> beneficiaries;
  final Map<String, dynamic>? additionalInfo;
  final String? status;
  final DateTime? createdAt;

  InsurancePolicyApplication({
    this.id,
    required this.policyType,
    required this.coverageAmount,
    required this.durationMonths,
    this.beneficiaries = const [],
    this.additionalInfo,
    this.status,
    this.createdAt,
  });

  factory InsurancePolicyApplication.fromJson(Map<String, dynamic> json) {
    return InsurancePolicyApplication(
      id: json['id'] ?? json['application_id'],
      policyType: json['policy_type'] ?? json['policyType'] ?? '',
      coverageAmount: (json['coverage_amount'] ?? json['coverageAmount'] ?? 0).toDouble(),
      durationMonths: json['duration_months'] ?? json['durationMonths'] ?? 0,
      beneficiaries: json['beneficiaries'] ?? [],
      additionalInfo: json['additional_info'] ?? json['additionalInfo'],
      status: json['status'],
      createdAt: json['created_at'] != null 
          ? DateTime.parse(json['created_at']) 
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      'policy_type': policyType,
      'coverage_amount': coverageAmount,
      'duration_months': durationMonths,
      'beneficiaries': beneficiaries,
      'additional_info': additionalInfo ?? {},
      if (status != null) 'status': status,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
    };
  }
}
