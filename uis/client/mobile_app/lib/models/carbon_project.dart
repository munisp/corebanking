class CarbonProject {
  final String id;
  final String name;
  final String description;
  final String location;
  final String projectType;
  final double pricePerCredit;
  final int availableCredits;
  final double impactPerCredit;
  final String? imageUrl;
  final String status;
  final Map<String, dynamic>? metadata;
  final DateTime createdAt;

  CarbonProject({
    required this.id,
    required this.name,
    required this.description,
    required this.location,
    required this.projectType,
    required this.pricePerCredit,
    required this.availableCredits,
    required this.impactPerCredit,
    this.imageUrl,
    required this.status,
    this.metadata,
    required this.createdAt,
  });

  factory CarbonProject.fromJson(Map<String, dynamic> json) {
    return CarbonProject(
      id: json['id'] ?? json['project_id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      location: json['location'] ?? '',
      projectType: json['project_type'] ?? json['projectType'] ?? '',
      pricePerCredit: (json['price_per_credit'] ?? json['pricePerCredit'] ?? 0).toDouble(),
      availableCredits: json['available_credits'] ?? json['availableCredits'] ?? 0,
      impactPerCredit: (json['impact_per_credit'] ?? json['impactPerCredit'] ?? 0).toDouble(),
      imageUrl: json['image_url'] ?? json['imageUrl'],
      status: json['status'] ?? 'active',
      metadata: json['metadata'] as Map<String, dynamic>?,
      createdAt: json['created_at'] != null 
          ? DateTime.parse(json['created_at']) 
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'location': location,
      'project_type': projectType,
      'price_per_credit': pricePerCredit,
      'available_credits': availableCredits,
      'impact_per_credit': impactPerCredit,
      'image_url': imageUrl,
      'status': status,
      'metadata': metadata,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
