class CarbonFootprint {
  final String id;
  final String userId;
  final double totalEmissions;
  final String period;
  final Map<String, dynamic>? breakdown;
  final DateTime createdAt;
  final DateTime updatedAt;

  CarbonFootprint({
    required this.id,
    required this.userId,
    required this.totalEmissions,
    required this.period,
    this.breakdown,
    required this.createdAt,
    required this.updatedAt,
  });

  factory CarbonFootprint.fromJson(Map<String, dynamic> json) {
    return CarbonFootprint(
      id: json['id'] ?? json['footprint_id'] ?? '',
      userId: json['user_id'] ?? json['userId'] ?? '',
      totalEmissions: (json['total_emissions'] ?? json['totalEmissions'] ?? 0).toDouble(),
      period: json['period'] ?? '',
      breakdown: json['breakdown'] as Map<String, dynamic>?,
      createdAt: json['created_at'] != null 
          ? DateTime.parse(json['created_at']) 
          : DateTime.now(),
      updatedAt: json['updated_at'] != null 
          ? DateTime.parse(json['updated_at']) 
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'total_emissions': totalEmissions,
      'period': period,
      'breakdown': breakdown,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }
}
