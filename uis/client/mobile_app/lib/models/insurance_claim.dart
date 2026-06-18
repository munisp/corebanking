class InsuranceClaim {
  final String id;
  final String policyId;
  final String userId;
  final double claimAmount;
  final DateTime incidentDate;
  final String incidentDescription;
  final String status;
  final List<String> supportingDocuments;
  final DateTime? approvalDate;
  final String? rejectionReason;
  final DateTime createdAt;
  final DateTime updatedAt;

  InsuranceClaim({
    required this.id,
    required this.policyId,
    required this.userId,
    required this.claimAmount,
    required this.incidentDate,
    required this.incidentDescription,
    required this.status,
    this.supportingDocuments = const [],
    this.approvalDate,
    this.rejectionReason,
    required this.createdAt,
    required this.updatedAt,
  });

  factory InsuranceClaim.fromJson(Map<String, dynamic> json) {
    List<String> documentsList = [];
    final docsField = json['supporting_documents'] ?? json['supportingDocuments'] ?? json['documents'];
    if (docsField != null) {
      if (docsField is List) {
        documentsList = List<String>.from(docsField);
      } else if (docsField is String) {
        documentsList = [docsField];
      }
    }

    String parseId(dynamic value) {
      if (value == null) return '';
      if (value is String) return value;
      return value.toString();
    }

    double parseAmount(dynamic value) {
      if (value == null) return 0.0;
      if (value is double) return value;
      if (value is int) return value.toDouble();
      if (value is String) return double.tryParse(value) ?? 0.0;
      return 0.0;
    }

    return InsuranceClaim(
      id: parseId(json['id'] ?? json['claim_id']),
      policyId: parseId(json['policy_id'] ?? json['policyId']),
      userId: parseId(json['customer_id'] ?? json['user_id'] ?? json['userId']),
      claimAmount: parseAmount(json['claim_amount'] ?? json['claimAmount']),
      incidentDate: json['incident_date'] != null
          ? DateTime.parse(json['incident_date'])
          : DateTime.now(),
      incidentDescription: json['incident_description'] ?? json['incidentDescription'] ?? json['description'] ?? '',
      status: json['status'] ?? 'pending',
      supportingDocuments: documentsList,
      approvalDate: json['approval_date'] != null
          ? DateTime.parse(json['approval_date'])
          : null,
      rejectionReason: json['rejection_reason'] ?? json['rejectionReason'],
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
      'policy_id': policyId,
      'customer_id': userId,
      'claim_amount': claimAmount,
      'incident_date': incidentDate.toIso8601String(),
      'incident_description': incidentDescription,
      'status': status,
      'supporting_documents': supportingDocuments,
      'approval_date': approvalDate?.toIso8601String(),
      'rejection_reason': rejectionReason,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }
}
