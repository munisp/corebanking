class FarmerProduct {
  final String id;
  final String name;
  final String category;
  final String description;
  final double interestRate;
  final double minAmount;
  final double maxAmount;
  final int minTenure;
  final int maxTenure;
  final List<String> eligibilityCriteria;
  final List<String> requiredDocuments;
  final bool isActive;

  FarmerProduct({
    required this.id,
    required this.name,
    required this.category,
    required this.description,
    required this.interestRate,
    required this.minAmount,
    required this.maxAmount,
    required this.minTenure,
    required this.maxTenure,
    required this.eligibilityCriteria,
    required this.requiredDocuments,
    required this.isActive,
  });

  factory FarmerProduct.fromJson(Map<String, dynamic> json) {
    return FarmerProduct(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      category: json['category'] ?? '',
      description: json['description'] ?? '',
      interestRate: (json['interest_rate'] ?? 0).toDouble(),
      minAmount: (json['min_amount'] ?? 0).toDouble(),
      maxAmount: (json['max_amount'] ?? 0).toDouble(),
      minTenure: json['min_tenure'] ?? 0,
      maxTenure: json['max_tenure'] ?? 0,
      eligibilityCriteria: (json['eligibility_criteria'] as List?)?.cast<String>() ?? [],
      requiredDocuments: (json['required_documents'] as List?)?.cast<String>() ?? [],
      isActive: json['is_active'] ?? true,
    );
  }
}

class ImpactMetrics {
  final int farmersReached;
  final double hectaresCultivated;
  final double yieldImprovement;
  final double incomeIncrease;
  final int jobsCreated;
  final int womenFarmers;
  final int youthFarmers;
  final int sustainablePractices;

  ImpactMetrics({
    required this.farmersReached,
    required this.hectaresCultivated,
    required this.yieldImprovement,
    required this.incomeIncrease,
    required this.jobsCreated,
    required this.womenFarmers,
    required this.youthFarmers,
    required this.sustainablePractices,
  });

  factory ImpactMetrics.fromJson(Map<String, dynamic> json) {
    return ImpactMetrics(
      farmersReached: json['farmers_reached'] ?? 0,
      hectaresCultivated: (json['hectares_cultivated'] ?? 0).toDouble(),
      yieldImprovement: (json['yield_improvement'] ?? 0).toDouble(),
      incomeIncrease: (json['income_increase'] ?? 0).toDouble(),
      jobsCreated: json['jobs_created'] ?? 0,
      womenFarmers: json['women_farmers'] ?? 0,
      youthFarmers: json['youth_farmers'] ?? 0,
      sustainablePractices: json['sustainable_practices'] ?? 0,
    );
  }
}
