import 'dart:convert';

class InsurancePolicy {
  final String id;
  final String userId;
  final String policyType;
  final double coverageAmount;
  final int durationMonths;
  final double premium;
  final String status;
  final List<dynamic> beneficiaries;
  final Map<String, dynamic>? additionalInfo;
  final DateTime startDate;
  final DateTime expiryDate;
  final DateTime? nextPaymentDate;
  final DateTime createdAt;
  final DateTime updatedAt;

  InsurancePolicy({
    required this.id,
    required this.userId,
    required this.policyType,
    required this.coverageAmount,
    required this.durationMonths,
    required this.premium,
    required this.status,
    required this.beneficiaries,
    this.additionalInfo,
    required this.startDate,
    required this.expiryDate,
    this.nextPaymentDate,
    required this.createdAt,
    required this.updatedAt,
  });

  factory InsurancePolicy.fromJson(Map<String, dynamic> json) {
    // Parse beneficiaries - API returns string "[]"
    List<dynamic> parsedBeneficiaries = [];
    if (json['beneficiaries'] != null) {
      if (json['beneficiaries'] is String) {
        try {
          final decoded = json['beneficiaries'] as String;
          if (decoded.isNotEmpty && decoded != '[]') {
            parsedBeneficiaries = List<dynamic>.from(
              (decoded.startsWith('[') ? jsonDecode(decoded) : [decoded]) as List
            );
          }
        } catch (e) {
          parsedBeneficiaries = [];
        }
      } else if (json['beneficiaries'] is List) {
        parsedBeneficiaries = json['beneficiaries'];
      }
    }

    // Parse additional_info - API returns string "{}"
    Map<String, dynamic>? parsedAdditionalInfo;
    if (json['additional_info'] != null || json['additionalInfo'] != null) {
      final info = json['additional_info'] ?? json['additionalInfo'];
      if (info is String) {
        try {
          if (info.isNotEmpty && info != '{}') {
            parsedAdditionalInfo = Map<String, dynamic>.from(jsonDecode(info));
          }
        } catch (e) {
          parsedAdditionalInfo = null;
        }
      } else if (info is Map) {
        parsedAdditionalInfo = Map<String, dynamic>.from(info);
      }
    }

    // Calculate expiry date from start_date and duration or use end_date
    DateTime calculatedExpiryDate;
    if (json['end_date'] != null && json['end_date'].toString().isNotEmpty) {
      calculatedExpiryDate = DateTime.parse(json['end_date']);
    } else if (json['expiry_date'] != null && json['expiry_date'].toString().isNotEmpty) {
      calculatedExpiryDate = DateTime.parse(json['expiry_date']);
    } else if (json['start_date'] != null && json['duration_months'] != null) {
      final start = DateTime.parse(json['start_date']);
      final duration = json['duration_months'] as int;
      calculatedExpiryDate = DateTime(start.year, start.month + duration, start.day);
    } else {
      calculatedExpiryDate = DateTime.now().add(Duration(days: 365));
    }

    return InsurancePolicy(
      id: (json['policy_id'] ?? json['id'] ?? '').toString(),
      userId: (json['customer_id'] ?? json['user_id'] ?? json['userId'] ?? '').toString(),
      policyType: json['policy_type'] ?? json['policyType'] ?? '',
      coverageAmount: (json['coverage_amount'] ?? json['coverageAmount'] ?? 0).toDouble(),
      durationMonths: json['duration_months'] ?? json['durationMonths'] ?? 12,
      premium: (json['premium_amount'] ?? json['premium'] ?? 0).toDouble(),
      status: json['status'] ?? 'active',
      beneficiaries: parsedBeneficiaries,
      additionalInfo: parsedAdditionalInfo,
      startDate: json['start_date'] != null && json['start_date'].toString().isNotEmpty
          ? DateTime.parse(json['start_date']) 
          : DateTime.now(),
      expiryDate: calculatedExpiryDate,
      nextPaymentDate: json['next_payment_date'] != null && json['next_payment_date'].toString().isNotEmpty
          ? DateTime.parse(json['next_payment_date']) 
          : null,
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
      'policy_type': policyType,
      'coverage_amount': coverageAmount,
      'duration_months': durationMonths,
      'premium': premium,
      'status': status,
      'beneficiaries': beneficiaries,
      'additional_info': additionalInfo,
      'start_date': startDate.toIso8601String(),
      'expiry_date': expiryDate.toIso8601String(),
      'next_payment_date': nextPaymentDate?.toIso8601String(),
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }
}
