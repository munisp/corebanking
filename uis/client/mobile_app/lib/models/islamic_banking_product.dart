class IslamicBankingProduct {
  final String id;
  final String userId;
  final String productType; // murabaha, musharaka, ijara, mudarabah, takaful, sukuk
  final String name;
  final String description;
  final double amount;
  final double profitRate;
  final String status; // active, pending, completed, cancelled
  final DateTime applicationDate;
  final DateTime? approvalDate;
  final DateTime? maturityDate;
  final String? referenceNumber;
  final DateTime createdAt;
  final DateTime? updatedAt;

  IslamicBankingProduct({
    required this.id,
    required this.userId,
    required this.productType,
    required this.name,
    required this.description,
    required this.amount,
    required this.profitRate,
    required this.status,
    required this.applicationDate,
    this.approvalDate,
    this.maturityDate,
    this.referenceNumber,
    required this.createdAt,
    this.updatedAt,
  });

  factory IslamicBankingProduct.fromJson(Map<String, dynamic> json) {
    double parseDouble(dynamic value, [double defaultValue = 0.0]) {
      if (value == null) return defaultValue;
      if (value is double) return value;
      if (value is int) return value.toDouble();
      if (value is String) {
        return double.tryParse(value) ?? defaultValue;
      }
      return defaultValue;
    }

    DateTime parseDateTime(dynamic value, [DateTime? defaultValue]) {
      if (value == null) return defaultValue ?? DateTime.now();
      if (value is DateTime) return value;
      if (value is String) {
        try {
          if (value.contains('T') || value.contains('Z')) {
            return DateTime.parse(value);
          }
          if (value.contains(' ')) {
            return DateTime.parse(value.replaceAll(' ', 'T'));
          }
          if (value.length == 10 && value.contains('-')) {
            return DateTime.parse('${value}T00:00:00');
          }
          return DateTime.parse(value);
        } catch (e) {
          return defaultValue ?? DateTime.now();
        }
      }
      return defaultValue ?? DateTime.now();
    }

    return IslamicBankingProduct(
      id: (json['id'] ?? json['product_id'] ?? '').toString(),
      userId: (json['user_id'] ?? json['customer_id'] ?? json['keycloak_id'] ?? '').toString(),
      productType: (json['product_type'] ?? '').toString(),
      name: (json['name'] ?? json['product_name'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      amount: parseDouble(json['amount']),
      profitRate: parseDouble(json['profit_rate']),
      status: (json['status'] ?? 'pending').toString(),
      applicationDate: parseDateTime(json['application_date'] ?? json['created_at']),
      approvalDate: (json['approval_date'] != null) ? parseDateTime(json['approval_date']) : null,
      maturityDate: (json['maturity_date'] != null) ? parseDateTime(json['maturity_date']) : null,
      referenceNumber: json['reference_number']?.toString(),
      createdAt: parseDateTime(json['created_at']),
      updatedAt: (json['updated_at'] != null) ? parseDateTime(json['updated_at']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'product_type': productType,
      'name': name,
      'description': description,
      'amount': amount,
      'profit_rate': profitRate,
      'status': status,
      'application_date': applicationDate.toIso8601String(),
      'approval_date': approvalDate?.toIso8601String(),
      'maturity_date': maturityDate?.toIso8601String(),
      'reference_number': referenceNumber,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }
}

// Murabaha - Cost-plus financing
class MurabahaProduct {
  final String id;
  final String userId;
  final String assetName;
  final double costPrice;
  final double sellingPrice;
  final double profitMargin;
  final int tenureMonths;
  final double monthlyInstallment;
  final String status;
  final DateTime applicationDate;
  final DateTime? approvalDate;
  final String? referenceNumber;
  final DateTime createdAt;
  final DateTime? updatedAt;

  MurabahaProduct({
    required this.id,
    required this.userId,
    required this.assetName,
    required this.costPrice,
    required this.sellingPrice,
    required this.profitMargin,
    required this.tenureMonths,
    required this.monthlyInstallment,
    required this.status,
    required this.applicationDate,
    this.approvalDate,
    this.referenceNumber,
    required this.createdAt,
    this.updatedAt,
  });

  factory MurabahaProduct.fromJson(Map<String, dynamic> json) {
    double parseDouble(dynamic value, [double defaultValue = 0.0]) {
      if (value == null) return defaultValue;
      if (value is double) return value;
      if (value is int) return value.toDouble();
      if (value is String) return double.tryParse(value) ?? defaultValue;
      return defaultValue;
    }

    int parseInt(dynamic value, [int defaultValue = 0]) {
      if (value == null) return defaultValue;
      if (value is int) return value;
      if (value is double) return value.toInt();
      if (value is String) return int.tryParse(value) ?? defaultValue;
      return defaultValue;
    }

    DateTime parseDateTime(dynamic value, [DateTime? defaultValue]) {
      if (value == null) return defaultValue ?? DateTime.now();
      if (value is DateTime) return value;
      if (value is String) {
        try {
          if (value.contains('T') || value.contains('Z')) return DateTime.parse(value);
          if (value.contains(' ')) return DateTime.parse(value.replaceAll(' ', 'T'));
          if (value.length == 10 && value.contains('-')) return DateTime.parse('${value}T00:00:00');
          return DateTime.parse(value);
        } catch (e) {
          return defaultValue ?? DateTime.now();
        }
      }
      return defaultValue ?? DateTime.now();
    }

    return MurabahaProduct(
      id: (json['id'] ?? json['murabaha_id'] ?? '').toString(),
      userId: (json['user_id'] ?? json['customer_id'] ?? json['keycloak_id'] ?? '').toString(),
      assetName: (json['asset_name'] ?? '').toString(),
      costPrice: parseDouble(json['cost_price']),
      sellingPrice: parseDouble(json['selling_price']),
      profitMargin: parseDouble(json['profit_margin']),
      tenureMonths: parseInt(json['tenure_months']),
      monthlyInstallment: parseDouble(json['monthly_installment']),
      status: (json['status'] ?? 'pending').toString(),
      applicationDate: parseDateTime(json['application_date'] ?? json['created_at']),
      approvalDate: (json['approval_date'] != null) ? parseDateTime(json['approval_date']) : null,
      referenceNumber: json['reference_number']?.toString(),
      createdAt: parseDateTime(json['created_at']),
      updatedAt: (json['updated_at'] != null) ? parseDateTime(json['updated_at']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'asset_name': assetName,
      'cost_price': costPrice,
      'selling_price': sellingPrice,
      'profit_margin': profitMargin,
      'tenure_months': tenureMonths,
      'monthly_installment': monthlyInstallment,
      'status': status,
      'application_date': applicationDate.toIso8601String(),
      'approval_date': approvalDate?.toIso8601String(),
      'reference_number': referenceNumber,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }
}

// Musharaka - Partnership financing
// MusharakaProduct
class MusharakaProduct {
  final String id;
  final String userId;
  final String businessName;
  final double bankContribution;
  final double customerContribution;
  final double totalCapital;
  final double bankProfitShare; // Percentage
  final double customerProfitShare; // Percentage
  final String status;
  final DateTime applicationDate;
  final DateTime? approvalDate;
  final String? referenceNumber;
  final DateTime createdAt;
  final DateTime? updatedAt;

  MusharakaProduct({
    required this.id,
    required this.userId,
    required this.businessName,
    required this.bankContribution,
    required this.customerContribution,
    required this.totalCapital,
    required this.bankProfitShare,
    required this.customerProfitShare,
    required this.status,
    required this.applicationDate,
    this.approvalDate,
    this.referenceNumber,
    required this.createdAt,
    this.updatedAt,
  });

  factory MusharakaProduct.fromJson(Map<String, dynamic> json) {
    double parseDouble(dynamic value, [double defaultValue = 0.0]) {
      if (value == null) return defaultValue;
      if (value is double) return value;
      if (value is int) return value.toDouble();
      if (value is String) return double.tryParse(value) ?? defaultValue;
      return defaultValue;
    }

    DateTime parseDateTime(dynamic value, [DateTime? defaultValue]) {
      if (value == null) return defaultValue ?? DateTime.now();
      if (value is DateTime) return value;
      if (value is String) {
        try {
          if (value.contains('T') || value.contains('Z')) return DateTime.parse(value);
          if (value.contains(' ')) return DateTime.parse(value.replaceAll(' ', 'T'));
          if (value.length == 10 && value.contains('-')) return DateTime.parse('${value}T00:00:00');
          return DateTime.parse(value);
        } catch (e) {
          return defaultValue ?? DateTime.now();
        }
      }
      return defaultValue ?? DateTime.now();
    }

    return MusharakaProduct(
      id: (json['id'] ?? json['musharaka_id'] ?? '').toString(),
      userId: (json['user_id'] ?? json['customer_id'] ?? json['keycloak_id'] ?? '').toString(),
      businessName: (json['business_name'] ?? '').toString(),
      bankContribution: parseDouble(json['bank_contribution']),
      customerContribution: parseDouble(json['customer_contribution']),
      totalCapital: parseDouble(json['total_capital']),
      bankProfitShare: parseDouble(json['bank_profit_share']),
      customerProfitShare: parseDouble(json['customer_profit_share']),
      status: (json['status'] ?? 'pending').toString(),
      applicationDate: parseDateTime(json['application_date'] ?? json['created_at']),
      approvalDate: (json['approval_date'] != null) ? parseDateTime(json['approval_date']) : null,
      referenceNumber: json['reference_number']?.toString(),
      createdAt: parseDateTime(json['created_at']),
      updatedAt: (json['updated_at'] != null) ? parseDateTime(json['updated_at']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'business_name': businessName,
      'bank_contribution': bankContribution,
      'customer_contribution': customerContribution,
      'total_capital': totalCapital,
      'bank_profit_share': bankProfitShare,
      'customer_profit_share': customerProfitShare,
      'status': status,
      'application_date': applicationDate.toIso8601String(),
      'approval_date': approvalDate?.toIso8601String(),
      'reference_number': referenceNumber,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }
}

// Ijara - Leasing
class IjaraProduct {
  final String id;
  final String userId;
  final String assetName;
  final double assetValue;
  final double monthlyRental;
  final int tenureMonths;
  final String leaseType; // operating, finance
  final String status;
  final DateTime applicationDate;
  final DateTime? approvalDate;
  final DateTime? leaseStartDate;
  final DateTime? leaseEndDate;
  final String? referenceNumber;
  final DateTime createdAt;
  final DateTime? updatedAt;

  IjaraProduct({
    required this.id,
    required this.userId,
    required this.assetName,
    required this.assetValue,
    required this.monthlyRental,
    required this.tenureMonths,
    required this.leaseType,
    required this.status,
    required this.applicationDate,
    this.approvalDate,
    this.leaseStartDate,
    this.leaseEndDate,
    this.referenceNumber,
    required this.createdAt,
    this.updatedAt,
  });

  factory IjaraProduct.fromJson(Map<String, dynamic> json) {
    double parseDouble(dynamic value, [double defaultValue = 0.0]) {
      if (value == null) return defaultValue;
      if (value is double) return value;
      if (value is int) return value.toDouble();
      if (value is String) return double.tryParse(value) ?? defaultValue;
      return defaultValue;
    }

    int parseInt(dynamic value, [int defaultValue = 0]) {
      if (value == null) return defaultValue;
      if (value is int) return value;
      if (value is double) return value.toInt();
      if (value is String) return int.tryParse(value) ?? defaultValue;
      return defaultValue;
    }

    DateTime parseDateTime(dynamic value, [DateTime? defaultValue]) {
      if (value == null) return defaultValue ?? DateTime.now();
      if (value is DateTime) return value;
      if (value is String) {
        try {
          if (value.contains('T') || value.contains('Z')) return DateTime.parse(value);
          if (value.contains(' ')) return DateTime.parse(value.replaceAll(' ', 'T'));
          if (value.length == 10 && value.contains('-')) return DateTime.parse('${value}T00:00:00');
          return DateTime.parse(value);
        } catch (e) {
          return defaultValue ?? DateTime.now();
        }
      }
      return defaultValue ?? DateTime.now();
    }

    return IjaraProduct(
      id: (json['id'] ?? json['ijara_id'] ?? '').toString(),
      userId: (json['user_id'] ?? json['customer_id'] ?? json['keycloak_id'] ?? '').toString(),
      assetName: (json['asset_name'] ?? '').toString(),
      assetValue: parseDouble(json['asset_value']),
      monthlyRental: parseDouble(json['monthly_rental']),
      tenureMonths: parseInt(json['tenure_months']),
      leaseType: (json['lease_type'] ?? 'operating').toString(),
      status: (json['status'] ?? 'pending').toString(),
      applicationDate: parseDateTime(json['application_date'] ?? json['created_at']),
      approvalDate: (json['approval_date'] != null) ? parseDateTime(json['approval_date']) : null,
      leaseStartDate: (json['lease_start_date'] != null) ? parseDateTime(json['lease_start_date']) : null,
      leaseEndDate: (json['lease_end_date'] != null) ? parseDateTime(json['lease_end_date']) : null,
      referenceNumber: json['reference_number']?.toString(),
      createdAt: parseDateTime(json['created_at']),
      updatedAt: (json['updated_at'] != null) ? parseDateTime(json['updated_at']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'asset_name': assetName,
      'asset_value': assetValue,
      'monthly_rental': monthlyRental,
      'tenure_months': tenureMonths,
      'lease_type': leaseType,
      'status': status,
      'application_date': applicationDate.toIso8601String(),
      'approval_date': approvalDate?.toIso8601String(),
      'lease_start_date': leaseStartDate?.toIso8601String(),
      'lease_end_date': leaseEndDate?.toIso8601String(),
      'reference_number': referenceNumber,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }
}

// Takaful - Islamic insurance
class TakafulProduct {
  final String id;
  final String userId;
  final String policyType; // family, general, health
  final String policyName;
  final double contributionAmount;
  final double coverageAmount;
  final String frequency; // monthly, quarterly, annually
  final String status;
  final DateTime applicationDate;
  final DateTime? approvalDate;
  final DateTime? policyStartDate;
  final DateTime? policyEndDate;
  final String? referenceNumber;
  final DateTime createdAt;
  final DateTime? updatedAt;

  TakafulProduct({
    required this.id,
    required this.userId,
    required this.policyType,
    required this.policyName,
    required this.contributionAmount,
    required this.coverageAmount,
    required this.frequency,
    required this.status,
    required this.applicationDate,
    this.approvalDate,
    this.policyStartDate,
    this.policyEndDate,
    this.referenceNumber,
    required this.createdAt,
    this.updatedAt,
  });

  factory TakafulProduct.fromJson(Map<String, dynamic> json) {
    double parseDouble(dynamic value, [double defaultValue = 0.0]) {
      if (value == null) return defaultValue;
      if (value is double) return value;
      if (value is int) return value.toDouble();
      if (value is String) return double.tryParse(value) ?? defaultValue;
      return defaultValue;
    }

    DateTime parseDateTime(dynamic value, [DateTime? defaultValue]) {
      if (value == null) return defaultValue ?? DateTime.now();
      if (value is DateTime) return value;
      if (value is String) {
        try {
          if (value.contains('T') || value.contains('Z')) return DateTime.parse(value);
          if (value.contains(' ')) return DateTime.parse(value.replaceAll(' ', 'T'));
          if (value.length == 10 && value.contains('-')) return DateTime.parse('${value}T00:00:00');
          return DateTime.parse(value);
        } catch (e) {
          return defaultValue ?? DateTime.now();
        }
      }
      return defaultValue ?? DateTime.now();
    }

    return TakafulProduct(
      id: (json['id'] ?? json['takaful_id'] ?? json['policy_id'] ?? '').toString(),
      userId: (json['user_id'] ?? json['customer_id'] ?? json['keycloak_id'] ?? '').toString(),
      policyType: (json['policy_type'] ?? '').toString(),
      policyName: (json['policy_name'] ?? json['name'] ?? '').toString(),
      contributionAmount: parseDouble(json['contribution_amount'] ?? json['premium_amount']),
      coverageAmount: parseDouble(json['coverage_amount']),
      frequency: (json['frequency'] ?? 'monthly').toString(),
      status: (json['status'] ?? 'pending').toString(),
      applicationDate: parseDateTime(json['application_date'] ?? json['created_at']),
      approvalDate: (json['approval_date'] != null) ? parseDateTime(json['approval_date']) : null,
      policyStartDate: (json['policy_start_date'] ?? json['start_date']) != null 
          ? parseDateTime(json['policy_start_date'] ?? json['start_date']) 
          : null,
      policyEndDate: (json['policy_end_date'] ?? json['end_date']) != null 
          ? parseDateTime(json['policy_end_date'] ?? json['end_date']) 
          : null,
      referenceNumber: json['reference_number']?.toString(),
      createdAt: parseDateTime(json['created_at']),
      updatedAt: (json['updated_at'] != null) ? parseDateTime(json['updated_at']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'policy_type': policyType,
      'policy_name': policyName,
      'contribution_amount': contributionAmount,
      'coverage_amount': coverageAmount,
      'frequency': frequency,
      'status': status,
      'application_date': applicationDate.toIso8601String(),
      'approval_date': approvalDate?.toIso8601String(),
      'policy_start_date': policyStartDate?.toIso8601String(),
      'policy_end_date': policyEndDate?.toIso8601String(),
      'reference_number': referenceNumber,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }
}

// Sukuk - Islamic bonds
class SukukProduct {
  final String id;
  final String userId;
  final String sukukType; // ijara, murabaha, musharaka
  final String sukukName;
  final double investmentAmount;
  final double expectedReturn; // Percentage
  final int tenureMonths;
  final String status;
  final DateTime applicationDate;
  final DateTime? approvalDate;
  final DateTime? maturityDate;
  final String? referenceNumber;
  final DateTime createdAt;
  final DateTime? updatedAt;

  SukukProduct({
    required this.id,
    required this.userId,
    required this.sukukType,
    required this.sukukName,
    required this.investmentAmount,
    required this.expectedReturn,
    required this.tenureMonths,
    required this.status,
    required this.applicationDate,
    this.approvalDate,
    this.maturityDate,
    this.referenceNumber,
    required this.createdAt,
    this.updatedAt,
  });

  factory SukukProduct.fromJson(Map<String, dynamic> json) {
    double parseDouble(dynamic value, [double defaultValue = 0.0]) {
      if (value == null) return defaultValue;
      if (value is double) return value;
      if (value is int) return value.toDouble();
      if (value is String) return double.tryParse(value) ?? defaultValue;
      return defaultValue;
    }

    int parseInt(dynamic value, [int defaultValue = 0]) {
      if (value == null) return defaultValue;
      if (value is int) return value;
      if (value is double) return value.toInt();
      if (value is String) return int.tryParse(value) ?? defaultValue;
      return defaultValue;
    }

    DateTime parseDateTime(dynamic value, [DateTime? defaultValue]) {
      if (value == null) return defaultValue ?? DateTime.now();
      if (value is DateTime) return value;
      if (value is String) {
        try {
          if (value.contains('T') || value.contains('Z')) return DateTime.parse(value);
          if (value.contains(' ')) return DateTime.parse(value.replaceAll(' ', 'T'));
          if (value.length == 10 && value.contains('-')) return DateTime.parse('${value}T00:00:00');
          return DateTime.parse(value);
        } catch (e) {
          return defaultValue ?? DateTime.now();
        }
      }
      return defaultValue ?? DateTime.now();
    }

    return SukukProduct(
      id: (json['id'] ?? json['sukuk_id'] ?? '').toString(),
      userId: (json['user_id'] ?? json['customer_id'] ?? json['keycloak_id'] ?? '').toString(),
      sukukType: (json['sukuk_type'] ?? '').toString(),
      sukukName: (json['sukuk_name'] ?? json['name'] ?? '').toString(),
      investmentAmount: parseDouble(json['investment_amount'] ?? json['amount']),
      expectedReturn: parseDouble(json['expected_return']),
      tenureMonths: parseInt(json['tenure_months']),
      status: (json['status'] ?? 'pending').toString(),
      applicationDate: parseDateTime(json['application_date'] ?? json['created_at']),
      approvalDate: (json['approval_date'] != null) ? parseDateTime(json['approval_date']) : null,
      maturityDate: (json['maturity_date'] != null) ? parseDateTime(json['maturity_date']) : null,
      referenceNumber: json['reference_number']?.toString(),
      createdAt: parseDateTime(json['created_at']),
      updatedAt: (json['updated_at'] != null) ? parseDateTime(json['updated_at']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'sukuk_type': sukukType,
      'sukuk_name': sukukName,
      'investment_amount': investmentAmount,
      'expected_return': expectedReturn,
      'tenure_months': tenureMonths,
      'status': status,
      'application_date': applicationDate.toIso8601String(),
      'approval_date': approvalDate?.toIso8601String(),
      'maturity_date': maturityDate?.toIso8601String(),
      'reference_number': referenceNumber,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }
}
