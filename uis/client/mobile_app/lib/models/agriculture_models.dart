import 'package:intl/intl.dart';

/// ==================== CORE ENUMS ====================

enum FarmerType { smallholder, commercial, cooperative }

enum CropCategory {
  cereal,
  legume,
  rootTuber,
  cash,
  vegetable,
  perennial,
  livestock,
}

enum FarmStatus {
  registered,
  verified,
  certified,
  active,
  inactive,
  suspended,
}

enum LoanStatus {
  applied,
  assessed,
  approved,
  rejected,
  disbursed,
  repaying,
  completed,
  defaulted,
}

enum TransactionType {
  deposit,
  withdrawal,
  loanDisbursement,
  loanRepayment,
  cooperativeContribution,
  marketplaceSale,
  marketplacePurchase,
  transfer,
  fee,
  interest,
}

enum TransactionStatus {
  pending,
  processing,
  completed,
  failed,
  cancelled,
  reversed,
}

enum InsuranceStatus {
  active,
  claimed,
  rejected,
  expired,
  lapsed,
}

/// ==================== FARMER PROFILE MODELS ====================

class FarmerProfile {
  final String id;
  final String userId;
  final String firstName;
  final String lastName;
  final String email;
  final String phone;
  final String? profileImageUrl;
  final FarmerType farmerType;
  final String farmLocation;
  final double? latitude;
  final double? longitude;
  final double farmSize; // in hectares
  final List<String> primaryCrops;
  final List<String> secondaryCrops;
  final String yearsOfExperience;
  final bool isKycVerified;
  final bool isPhoneVerified;
  final bool isFarmVerified;
  final String? bvn;
  final String? nin;
  final DateTime createdAt;
  final DateTime updatedAt;
  final Map<String, dynamic>? metadata;

  FarmerProfile({
    required this.id,
    required this.userId,
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.phone,
    this.profileImageUrl,
    required this.farmerType,
    required this.farmLocation,
    this.latitude,
    this.longitude,
    required this.farmSize,
    required this.primaryCrops,
    required this.secondaryCrops,
    required this.yearsOfExperience,
    required this.isKycVerified,
    required this.isPhoneVerified,
    required this.isFarmVerified,
    this.bvn,
    this.nin,
    required this.createdAt,
    required this.updatedAt,
    this.metadata,
  });

  String get fullName => '$firstName $lastName';

  bool get isFullyVerified => isKycVerified && isPhoneVerified && isFarmVerified;

  Map<String, dynamic> toJson() => {
    'id': id,
    'user_id': userId,
    'first_name': firstName,
    'last_name': lastName,
    'email': email,
    'phone': phone,
    'profile_image_url': profileImageUrl,
    'farmer_type': farmerType.name,
    'farm_location': farmLocation,
    'latitude': latitude,
    'longitude': longitude,
    'farm_size': farmSize,
    'primary_crops': primaryCrops,
    'secondary_crops': secondaryCrops,
    'years_of_experience': yearsOfExperience,
    'is_kyc_verified': isKycVerified,
    'is_phone_verified': isPhoneVerified,
    'is_farm_verified': isFarmVerified,
    'bvn': bvn,
    'nin': nin,
    'created_at': createdAt.toIso8601String(),
    'updated_at': updatedAt.toIso8601String(),
    'metadata': metadata,
  };

  factory FarmerProfile.fromJson(Map<String, dynamic> json) => FarmerProfile(
    id: json['id'] ?? '',
    userId: json['user_id'] ?? '',
    firstName: json['first_name'] ?? '',
    lastName: json['last_name'] ?? '',
    email: json['email'] ?? '',
    phone: json['phone'] ?? '',
    profileImageUrl: json['profile_image_url'],
    farmerType: FarmerType.values.byName(json['farmer_type'] ?? 'smallholder'),
    farmLocation: json['farm_location'] ?? '',
    latitude: (json['latitude'] as num?)?.toDouble(),
    longitude: (json['longitude'] as num?)?.toDouble(),
    farmSize: (json['farm_size'] as num?)?.toDouble() ?? 0,
    primaryCrops: List<String>.from(json['primary_crops'] ?? []),
    secondaryCrops: List<String>.from(json['secondary_crops'] ?? []),
    yearsOfExperience: json['years_of_experience'] ?? '',
    isKycVerified: json['is_kyc_verified'] ?? false,
    isPhoneVerified: json['is_phone_verified'] ?? false,
    isFarmVerified: json['is_farm_verified'] ?? false,
    bvn: json['bvn'],
    nin: json['nin'],
    createdAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
    updatedAt: DateTime.tryParse(json['updated_at'] ?? '') ?? DateTime.now(),
    metadata: json['metadata'],
  );
}

/// ==================== FARM MODELS ====================

class Farm {
  final String id;
  final String farmerId;
  final String name;
  final String location;
  final double latitude;
  final double longitude;
  final double sizeHectares;
  final String soilType;
  final String climate;
  final List<String> crops;
  final FarmStatus status;
  final DateTime registeredAt;
  final DateTime? verifiedAt;
  final DateTime? certifiedAt;
  final Map<String, dynamic>? metadata;

  Farm({
    required this.id,
    required this.farmerId,
    required this.name,
    required this.location,
    required this.latitude,
    required this.longitude,
    required this.sizeHectares,
    required this.soilType,
    required this.climate,
    required this.crops,
    required this.status,
    required this.registeredAt,
    this.verifiedAt,
    this.certifiedAt,
    this.metadata,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmer_id': farmerId,
    'name': name,
    'location': location,
    'latitude': latitude,
    'longitude': longitude,
    'size_hectares': sizeHectares,
    'soil_type': soilType,
    'climate': climate,
    'crops': crops,
    'status': status.name,
    'registered_at': registeredAt.toIso8601String(),
    'verified_at': verifiedAt?.toIso8601String(),
    'certified_at': certifiedAt?.toIso8601String(),
    'metadata': metadata,
  };

  factory Farm.fromJson(Map<String, dynamic> json) => Farm(
    id: json['id'] ?? '',
    farmerId: json['farmer_id'] ?? '',
    name: json['name'] ?? '',
    location: json['location'] ?? '',
    latitude: (json['latitude'] as num?)?.toDouble() ?? 0,
    longitude: (json['longitude'] as num?)?.toDouble() ?? 0,
    sizeHectares: (json['size_hectares'] as num?)?.toDouble() ?? 0,
    soilType: json['soil_type'] ?? '',
    climate: json['climate'] ?? '',
    crops: List<String>.from(json['crops'] ?? []),
    status: FarmStatus.values.byName(json['status'] ?? 'registered'),
    registeredAt: DateTime.tryParse(json['registered_at'] ?? '') ?? DateTime.now(),
    verifiedAt: DateTime.tryParse(json['verified_at'] ?? ''),
    certifiedAt: DateTime.tryParse(json['certified_at'] ?? ''),
    metadata: json['metadata'],
  );
}

/// ==================== CROP MODELS ====================

class CropMarketData {
  final String cropType;
  final String localName;
  final int growingPeriodDays;
  final double averageYieldPerHectare;
  final double marketPricePerTonne;
  final double inputCostPerHectare;
  final String riskLevel;
  final String optimalSeason;
  final String waterRequirement;
  final List<String> suitableSoilTypes;
  final String? imageUrl;
  final Map<String, dynamic>? metadata;

  CropMarketData({
    required this.cropType,
    required this.localName,
    required this.growingPeriodDays,
    required this.averageYieldPerHectare,
    required this.marketPricePerTonne,
    required this.inputCostPerHectare,
    required this.riskLevel,
    required this.optimalSeason,
    required this.waterRequirement,
    required this.suitableSoilTypes,
    this.imageUrl,
    this.metadata,
  });

  double get estimatedRevenuePerHectare =>
      (averageYieldPerHectare * marketPricePerTonne) - inputCostPerHectare;

  double get profitMargin {
    final revenue = estimatedRevenuePerHectare;
    return revenue > 0 ? (revenue / (averageYieldPerHectare * marketPricePerTonne)) * 100 : 0;
  }

  Map<String, dynamic> toJson() => {
    'crop_type': cropType,
    'local_name': localName,
    'growing_period_days': growingPeriodDays,
    'average_yield_per_hectare': averageYieldPerHectare,
    'market_price_per_tonne': marketPricePerTonne,
    'input_cost_per_hectare': inputCostPerHectare,
    'risk_level': riskLevel,
    'optimal_season': optimalSeason,
    'water_requirement': waterRequirement,
    'suitable_soil_types': suitableSoilTypes,
    'image_url': imageUrl,
    'metadata': metadata,
  };

  factory CropMarketData.fromJson(Map<String, dynamic> json) => CropMarketData(
    cropType: json['crop_type'] ?? '',
    localName: json['local_name'] ?? '',
    growingPeriodDays: json['growing_period_days'] ?? 0,
    averageYieldPerHectare: (json['average_yield_per_hectare'] as num?)?.toDouble() ?? 0,
    marketPricePerTonne: (json['market_price_per_tonne'] as num?)?.toDouble() ?? 0,
    inputCostPerHectare: (json['input_cost_per_hectare'] as num?)?.toDouble() ?? 0,
    riskLevel: json['risk_level'] ?? '',
    optimalSeason: json['optimal_season'] ?? '',
    waterRequirement: json['water_requirement'] ?? '',
    suitableSoilTypes: List<String>.from(json['suitable_soil_types'] ?? []),
    imageUrl: json['image_url'],
    metadata: json['metadata'],
  );
}

/// ==================== AGRICULTURAL LOAN MODELS ====================

class AgriculturalLoan {
  final String id;
  final String farmerId;
  final String? farmId;
  final double amount;
  final double interestRate;
  final int tenorMonths;
  final String currency;
  final LoanStatus status;
  final String? approvedBy;
  final double? disbursedAmount;
  final DateTime appliedAt;
  final DateTime? approvedAt;
  final DateTime? disbursedAt;
  final DateTime? dueAt;
  final double? outstandingBalance;
  final List<LoanRepayment>? repayments;
  final String? purpose;
  final String? collateral;
  final Map<String, dynamic>? metadata;

  AgriculturalLoan({
    required this.id,
    required this.farmerId,
    this.farmId,
    required this.amount,
    required this.interestRate,
    required this.tenorMonths,
    required this.currency,
    required this.status,
    this.approvedBy,
    this.disbursedAmount,
    required this.appliedAt,
    this.approvedAt,
    this.disbursedAt,
    this.dueAt,
    this.outstandingBalance,
    this.repayments,
    this.purpose,
    this.collateral,
    this.metadata,
  });

  double get totalRepayable => amount * (1 + (interestRate / 100));

  double get monthlyPayment => totalRepayable / tenorMonths;

  int get daysSinceDisbursement {
    if (disbursedAt == null) return 0;
    return DateTime.now().difference(disbursedAt!).inDays;
  }

  double get progressPercentage {
    if (disbursedAmount == null || disbursedAmount == 0) return 0;
    final paid = (disbursedAmount ?? 0) - (outstandingBalance ?? 0);
    return (paid / (disbursedAmount ?? 1)) * 100;
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmer_id': farmerId,
    'farm_id': farmId,
    'amount': amount,
    'interest_rate': interestRate,
    'tenor_months': tenorMonths,
    'currency': currency,
    'status': status.name,
    'approved_by': approvedBy,
    'disbursed_amount': disbursedAmount,
    'applied_at': appliedAt.toIso8601String(),
    'approved_at': approvedAt?.toIso8601String(),
    'disbursed_at': disbursedAt?.toIso8601String(),
    'due_at': dueAt?.toIso8601String(),
    'outstanding_balance': outstandingBalance,
    'purpose': purpose,
    'collateral': collateral,
    'metadata': metadata,
  };

  factory AgriculturalLoan.fromJson(Map<String, dynamic> json) => AgriculturalLoan(
    id: json['id'] ?? '',
    farmerId: json['farmer_id'] ?? '',
    farmId: json['farm_id'],
    amount: (json['amount'] as num?)?.toDouble() ?? 0,
    interestRate: (json['interest_rate'] as num?)?.toDouble() ?? 0,
    tenorMonths: json['tenor_months'] ?? 0,
    currency: json['currency'] ?? 'NGN',
    status: LoanStatus.values.byName(json['status'] ?? 'applied'),
    approvedBy: json['approved_by'],
    disbursedAmount: (json['disbursed_amount'] as num?)?.toDouble(),
    appliedAt: DateTime.tryParse(json['applied_at'] ?? '') ?? DateTime.now(),
    approvedAt: DateTime.tryParse(json['approved_at'] ?? ''),
    disbursedAt: DateTime.tryParse(json['disbursed_at'] ?? ''),
    dueAt: DateTime.tryParse(json['due_at'] ?? ''),
    outstandingBalance: (json['outstanding_balance'] as num?)?.toDouble(),
    repayments: (json['repayments'] as List?)
        ?.map((r) => LoanRepayment.fromJson(r))
        .toList(),
    purpose: json['purpose'],
    collateral: json['collateral'],
    metadata: json['metadata'],
  );
}

class LoanRepayment {
  final String id;
  final String loanId;
  final double amount;
  final DateTime dueDate;
  final DateTime? paidDate;
  final TransactionStatus status;
  final String? transactionReference;

  LoanRepayment({
    required this.id,
    required this.loanId,
    required this.amount,
    required this.dueDate,
    this.paidDate,
    required this.status,
    this.transactionReference,
  });

  bool get isOverdue => status != TransactionStatus.completed && DateTime.now().isAfter(dueDate);

  int get daysOverdue {
    if (!isOverdue) return 0;
    return DateTime.now().difference(dueDate).inDays;
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'loan_id': loanId,
    'amount': amount,
    'due_date': dueDate.toIso8601String(),
    'paid_date': paidDate?.toIso8601String(),
    'status': status.name,
    'transaction_reference': transactionReference,
  };

  factory LoanRepayment.fromJson(Map<String, dynamic> json) => LoanRepayment(
    id: json['id'] ?? '',
    loanId: json['loan_id'] ?? '',
    amount: (json['amount'] as num?)?.toDouble() ?? 0,
    dueDate: DateTime.tryParse(json['due_date'] ?? '') ?? DateTime.now(),
    paidDate: DateTime.tryParse(json['paid_date'] ?? ''),
    status: TransactionStatus.values.byName(json['status'] ?? 'pending'),
    transactionReference: json['transaction_reference'],
  );
}

/// ==================== TRANSACTION MODELS ====================

class Transaction {
  final String id;
  final String farmerId;
  final double amount;
  final String currency;
  final TransactionType type;
  final TransactionStatus status;
  final String? reference;
  final String? description;
  final DateTime createdAt;
  final DateTime? completedAt;
  final String? sourceAccountId;
  final String? destinationAccountId;
  final Map<String, dynamic>? metadata;

  Transaction({
    required this.id,
    required this.farmerId,
    required this.amount,
    required this.currency,
    required this.type,
    required this.status,
    this.reference,
    this.description,
    required this.createdAt,
    this.completedAt,
    this.sourceAccountId,
    this.destinationAccountId,
    this.metadata,
  });

  String get formattedAmount => NumberFormat.currency(
    symbol: currency,
    decimalDigits: 2,
  ).format(amount);

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmer_id': farmerId,
    'amount': amount,
    'currency': currency,
    'type': type.name,
    'status': status.name,
    'reference': reference,
    'description': description,
    'created_at': createdAt.toIso8601String(),
    'completed_at': completedAt?.toIso8601String(),
    'source_account_id': sourceAccountId,
    'destination_account_id': destinationAccountId,
    'metadata': metadata,
  };

  factory Transaction.fromJson(Map<String, dynamic> json) => Transaction(
    id: json['id'] ?? '',
    farmerId: json['farmer_id'] ?? '',
    amount: (json['amount'] as num?)?.toDouble() ?? 0,
    currency: json['currency'] ?? 'NGN',
    type: TransactionType.values.byName(json['type'] ?? 'transfer'),
    status: TransactionStatus.values.byName(json['status'] ?? 'pending'),
    reference: json['reference'],
    description: json['description'],
    createdAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
    completedAt: DateTime.tryParse(json['completed_at'] ?? ''),
    sourceAccountId: json['source_account_id'],
    destinationAccountId: json['destination_account_id'],
    metadata: json['metadata'],
  );
}

/// ==================== WALLET MODELS ====================

class Wallet {
  final String id;
  final String farmerId;
  final double balance;
  final String currency;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<Transaction>? recentTransactions;

  Wallet({
    required this.id,
    required this.farmerId,
    required this.balance,
    required this.currency,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
    this.recentTransactions,
  });

  String get formattedBalance => NumberFormat.currency(
    symbol: currency,
    decimalDigits: 2,
  ).format(balance);

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmer_id': farmerId,
    'balance': balance,
    'currency': currency,
    'is_active': isActive,
    'created_at': createdAt.toIso8601String(),
    'updated_at': updatedAt.toIso8601String(),
    'recent_transactions': recentTransactions?.map((t) => t.toJson()).toList(),
  };

  factory Wallet.fromJson(Map<String, dynamic> json) => Wallet(
    id: json['id'] ?? '',
    farmerId: json['farmer_id'] ?? '',
    balance: (json['balance'] as num?)?.toDouble() ?? 0,
    currency: json['currency'] ?? 'NGN',
    isActive: json['is_active'] ?? true,
    createdAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
    updatedAt: DateTime.tryParse(json['updated_at'] ?? '') ?? DateTime.now(),
    recentTransactions: (json['recent_transactions'] as List?)
        ?.map((t) => Transaction.fromJson(t))
        .toList(),
  );
}

/// ==================== COOPERATIVE SAVINGS MODELS ====================

class CooperativeSavings {
  final String id;
  final String name;
  final String description;
  final int memberCount;
  final double totalSavings;
  final String currency;
  final double targetAmount;
  final int savingCycleMonths;
  final DateTime createdAt;
  final DateTime? nextPaymentDate;
  final List<CooperativeMember>? members;

  CooperativeSavings({
    required this.id,
    required this.name,
    required this.description,
    required this.memberCount,
    required this.totalSavings,
    required this.currency,
    required this.targetAmount,
    required this.savingCycleMonths,
    required this.createdAt,
    this.nextPaymentDate,
    this.members,
  });

  double get savingsProgressPercentage => (totalSavings / targetAmount) * 100;

  double get perMemberAverage => memberCount > 0 ? totalSavings / memberCount : 0;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'description': description,
    'member_count': memberCount,
    'total_savings': totalSavings,
    'currency': currency,
    'target_amount': targetAmount,
    'saving_cycle_months': savingCycleMonths,
    'created_at': createdAt.toIso8601String(),
    'next_payment_date': nextPaymentDate?.toIso8601String(),
    'members': members?.map((m) => m.toJson()).toList(),
  };

  factory CooperativeSavings.fromJson(Map<String, dynamic> json) => CooperativeSavings(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    description: json['description'] ?? '',
    memberCount: json['member_count'] ?? 0,
    totalSavings: (json['total_savings'] as num?)?.toDouble() ?? 0,
    currency: json['currency'] ?? 'NGN',
    targetAmount: (json['target_amount'] as num?)?.toDouble() ?? 0,
    savingCycleMonths: json['saving_cycle_months'] ?? 1,
    createdAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
    nextPaymentDate: DateTime.tryParse(json['next_payment_date'] ?? ''),
    members: (json['members'] as List?)
        ?.map((m) => CooperativeMember.fromJson(m))
        .toList(),
  );
}

class CooperativeMember {
  final String id;
  final String cooperativeId;
  final String farmerId;
  final String farmerName;
  final double totalContributions;
  final DateTime joinedAt;

  CooperativeMember({
    required this.id,
    required this.cooperativeId,
    required this.farmerId,
    required this.farmerName,
    required this.totalContributions,
    required this.joinedAt,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'cooperative_id': cooperativeId,
    'farmer_id': farmerId,
    'farmer_name': farmerName,
    'total_contributions': totalContributions,
    'joined_at': joinedAt.toIso8601String(),
  };

  factory CooperativeMember.fromJson(Map<String, dynamic> json) => CooperativeMember(
    id: json['id'] ?? '',
    cooperativeId: json['cooperative_id'] ?? '',
    farmerId: json['farmer_id'] ?? '',
    farmerName: json['farmer_name'] ?? '',
    totalContributions: (json['total_contributions'] as num?)?.toDouble() ?? 0,
    joinedAt: DateTime.tryParse(json['joined_at'] ?? '') ?? DateTime.now(),
  );
}

/// ==================== AGRICULTURAL INSURANCE MODELS ====================

class AgriculturalInsurancePolicy {
  final String id;
  final String farmerId;
  final String policyType; // crop, livestock, weather
  final double coverageAmount;
  final double premiumAmount;
  final String currency;
  final InsuranceStatus status;
  final DateTime startDate;
  final DateTime endDate;
  final String? coverageDetails;
  final List<InsuranceClaim>? claims;

  AgriculturalInsurancePolicy({
    required this.id,
    required this.farmerId,
    required this.policyType,
    required this.coverageAmount,
    required this.premiumAmount,
    required this.currency,
    required this.status,
    required this.startDate,
    required this.endDate,
    this.coverageDetails,
    this.claims,
  });

  bool get isActive => status == InsuranceStatus.active && DateTime.now().isBefore(endDate);

  int get daysRemaining => endDate.difference(DateTime.now()).inDays;

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmer_id': farmerId,
    'policy_type': policyType,
    'coverage_amount': coverageAmount,
    'premium_amount': premiumAmount,
    'currency': currency,
    'status': status.name,
    'start_date': startDate.toIso8601String(),
    'end_date': endDate.toIso8601String(),
    'coverage_details': coverageDetails,
    'claims': claims?.map((c) => c.toJson()).toList(),
  };

  factory AgriculturalInsurancePolicy.fromJson(Map<String, dynamic> json) =>
      AgriculturalInsurancePolicy(
        id: json['id'] ?? '',
        farmerId: json['farmer_id'] ?? '',
        policyType: json['policy_type'] ?? '',
        coverageAmount: (json['coverage_amount'] as num?)?.toDouble() ?? 0,
        premiumAmount: (json['premium_amount'] as num?)?.toDouble() ?? 0,
        currency: json['currency'] ?? 'NGN',
        status: InsuranceStatus.values.byName(json['status'] ?? 'active'),
        startDate: DateTime.tryParse(json['start_date'] ?? '') ?? DateTime.now(),
        endDate: DateTime.tryParse(json['end_date'] ?? '') ?? DateTime.now(),
        coverageDetails: json['coverage_details'],
        claims: (json['claims'] as List?)
            ?.map((c) => InsuranceClaim.fromJson(c))
            .toList(),
      );
}

class InsuranceClaim {
  final String id;
  final String policyId;
  final String reason;
  final double claimAmount;
  final String status; // pending, approved, rejected, paid
  final DateTime submittedAt;
  final DateTime? resolvedAt;
  final String? resolution;

  InsuranceClaim({
    required this.id,
    required this.policyId,
    required this.reason,
    required this.claimAmount,
    required this.status,
    required this.submittedAt,
    this.resolvedAt,
    this.resolution,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'policy_id': policyId,
    'reason': reason,
    'claim_amount': claimAmount,
    'status': status,
    'submitted_at': submittedAt.toIso8601String(),
    'resolved_at': resolvedAt?.toIso8601String(),
    'resolution': resolution,
  };

  factory InsuranceClaim.fromJson(Map<String, dynamic> json) => InsuranceClaim(
    id: json['id'] ?? '',
    policyId: json['policy_id'] ?? '',
    reason: json['reason'] ?? '',
    claimAmount: (json['claim_amount'] as num?)?.toDouble() ?? 0,
    status: json['status'] ?? '',
    submittedAt: DateTime.tryParse(json['submitted_at'] ?? '') ?? DateTime.now(),
    resolvedAt: DateTime.tryParse(json['resolved_at'] ?? ''),
    resolution: json['resolution'],
  );
}

/// ==================== MARKETPLACE MODELS ====================

class MarketplaceListing {
  final String id;
  final String farmerId;
  final String farmerName;
  final String cropType;
  final double quantityTonnes;
  final double pricePerTonne;
  final String currency;
  final String location;
  final String listingStatus; // active, sold, expired
  final DateTime listedAt;
  final DateTime? soldAt;
  final String? imageUrl;

  MarketplaceListing({
    required this.id,
    required this.farmerId,
    required this.farmerName,
    required this.cropType,
    required this.quantityTonnes,
    required this.pricePerTonne,
    required this.currency,
    required this.location,
    required this.listingStatus,
    required this.listedAt,
    this.soldAt,
    this.imageUrl,
  });

  double get totalValue => quantityTonnes * pricePerTonne;

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmer_id': farmerId,
    'farmer_name': farmerName,
    'crop_type': cropType,
    'quantity_tonnes': quantityTonnes,
    'price_per_tonne': pricePerTonne,
    'currency': currency,
    'location': location,
    'listing_status': listingStatus,
    'listed_at': listedAt.toIso8601String(),
    'sold_at': soldAt?.toIso8601String(),
    'image_url': imageUrl,
  };

  factory MarketplaceListing.fromJson(Map<String, dynamic> json) => MarketplaceListing(
    id: json['id'] ?? '',
    farmerId: json['farmer_id'] ?? '',
    farmerName: json['farmer_name'] ?? '',
    cropType: json['crop_type'] ?? '',
    quantityTonnes: (json['quantity_tonnes'] as num?)?.toDouble() ?? 0,
    pricePerTonne: (json['price_per_tonne'] as num?)?.toDouble() ?? 0,
    currency: json['currency'] ?? 'NGN',
    location: json['location'] ?? '',
    listingStatus: json['listing_status'] ?? 'active',
    listedAt: DateTime.tryParse(json['listed_at'] ?? '') ?? DateTime.now(),
    soldAt: DateTime.tryParse(json['sold_at'] ?? ''),
    imageUrl: json['image_url'],
  );
}
