import 'dart:convert';

class EtheriscPolicy {
  final int id;
  final String policyId;
  final String customerId;
  final String tenantId;
  final String insuranceType;
  final double coverageAmount;
  final double premiumAmount;
  final Map<String, dynamic> triggerConditions;
  final int durationDays;
  final DateTime startDate;
  final DateTime endDate;
  final String status;
  final String? smartContractAddress;
  final String? blockchainTxHash;
  final DateTime createdAt;
  final DateTime updatedAt;

  EtheriscPolicy({
    required this.id,
    required this.policyId,
    required this.customerId,
    required this.tenantId,
    required this.insuranceType,
    required this.coverageAmount,
    required this.premiumAmount,
    required this.triggerConditions,
    required this.durationDays,
    required this.startDate,
    required this.endDate,
    required this.status,
    this.smartContractAddress,
    this.blockchainTxHash,
    required this.createdAt,
    required this.updatedAt,
  });

  factory EtheriscPolicy.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic> parsedTriggerConditions = {};
    if (json['trigger_conditions'] != null) {
      if (json['trigger_conditions'] is String) {
        try {
          parsedTriggerConditions = Map<String, dynamic>.from(
            jsonDecode(json['trigger_conditions'])
          );
        } catch (e) {
          parsedTriggerConditions = {};
        }
      } else if (json['trigger_conditions'] is Map) {
        parsedTriggerConditions = Map<String, dynamic>.from(json['trigger_conditions']);
      }
    }

    return EtheriscPolicy(
      id: json['id'] ?? 0,
      policyId: json['policy_id'] ?? '',
      customerId: json['customer_id'] ?? '',
      tenantId: json['tenant_id'] ?? '',
      insuranceType: json['insurance_type'] ?? '',
      coverageAmount: (json['coverage_amount'] ?? 0).toDouble(),
      premiumAmount: (json['premium_amount'] ?? 0).toDouble(),
      triggerConditions: parsedTriggerConditions,
      durationDays: json['duration_days'] ?? 0,
      startDate: json['start_date'] != null 
          ? DateTime.parse(json['start_date']) 
          : DateTime.now(),
      endDate: json['end_date'] != null 
          ? DateTime.parse(json['end_date']) 
          : DateTime.now(),
      status: json['status'] ?? '',
      smartContractAddress: json['smart_contract_address'],
      blockchainTxHash: json['blockchain_tx_hash'],
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
      'customer_id': customerId,
      'tenant_id': tenantId,
      'insurance_type': insuranceType,
      'coverage_amount': coverageAmount,
      'premium_amount': premiumAmount,
      'trigger_conditions': jsonEncode(triggerConditions),
      'duration_days': durationDays,
      'start_date': startDate.toIso8601String(),
      'end_date': endDate.toIso8601String(),
      'status': status,
      'smart_contract_address': smartContractAddress,
      'blockchain_tx_hash': blockchainTxHash,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  // Helper to get display name for insurance type
  String get displayName {
    switch (insuranceType.toLowerCase()) {
      case 'crop_weather':
        return 'Crop Weather Insurance';
      case 'flight_delay':
        return 'Flight Delay Insurance';
      case 'health':
        return 'Health Insurance';
      case 'life':
        return 'Life Insurance';
      case 'auto':
        return 'Auto Insurance';
      case 'travel':
        return 'Travel Insurance';
      default:
        return insuranceType.replaceAll('_', ' ').split(' ').map((word) => 
          word[0].toUpperCase() + word.substring(1)
        ).join(' ');
    }
  }

  // Convert to months (approximate)
  int get durationMonths => (durationDays / 30).ceil();
}
