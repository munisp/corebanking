import 'package:intl/intl.dart';

/// ==================== EXTENDED AGRICULTURAL MODELS ====================
/// This file extends the base agriculture_models.dart with 19 complete features
/// Including: Agri Insurance, Partners, Risk, eVoucher, IoT, Logistics, Savings,
/// Reinsurance, Yield Prediction, Boundary Mapping, Satellite, Soil Analysis,
/// Livestock Finance, Livestock Management, Commodity Exchange, Warehouse,
/// CBN Returns, NIRSAL AgroGeoCoop, and Anchor Borrowers

// ========== AGRI PARTNERS ==========

enum PartnershipType { supplier, buyer, service, technology, financial }

class AgriculturalPartner {
  final String id;
  final String name;
  final String description;
  final PartnershipType type;
  final String contactEmail;
  final String contactPhone;
  final String? logoUrl;
  final List<String> servicesOffered;
  final String? websiteUrl;
  final String location;
  final double rating;
  final int totalRatings;
  final bool isVerified;
  final DateTime createdAt;
  final DateTime updatedAt;

  AgriculturalPartner({
    required this.id,
    required this.name,
    required this.description,
    required this.type,
    required this.contactEmail,
    required this.contactPhone,
    this.logoUrl,
    required this.servicesOffered,
    this.websiteUrl,
    required this.location,
    required this.rating,
    required this.totalRatings,
    required this.isVerified,
    required this.createdAt,
    required this.updatedAt,
  });

  factory AgriculturalPartner.fromJson(Map<String, dynamic> json) {
    return AgriculturalPartner(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      type: PartnershipType.values[json['type'] ?? 0],
      contactEmail: json['contactEmail'] as String,
      contactPhone: json['contactPhone'] as String,
      logoUrl: json['logoUrl'] as String?,
      servicesOffered: List<String>.from(json['servicesOffered'] ?? []),
      websiteUrl: json['websiteUrl'] as String?,
      location: json['location'] as String,
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
      totalRatings: json['totalRatings'] as int? ?? 0,
      isVerified: json['isVerified'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'description': description,
    'type': type.index,
    'contactEmail': contactEmail,
    'contactPhone': contactPhone,
    'logoUrl': logoUrl,
    'servicesOffered': servicesOffered,
    'websiteUrl': websiteUrl,
    'location': location,
    'rating': rating,
    'totalRatings': totalRatings,
    'isVerified': isVerified,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== AGRI RISK ==========

enum RiskLevel { low, medium, high, critical }
enum RiskType { weather, disease, market, financial, operational, environmental }

class AgriculturalRisk {
  final String id;
  final String farmId;
  final RiskType riskType;
  final RiskLevel severity;
  final String description;
  final double? likelihood; // 0-1
  final double? impact; // 0-1
  final String? mitigation;
  final bool isActive;
  final DateTime? detectedAt;
  final DateTime? resolvedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  AgriculturalRisk({
    required this.id,
    required this.farmId,
    required this.riskType,
    required this.severity,
    required this.description,
    this.likelihood,
    this.impact,
    this.mitigation,
    required this.isActive,
    this.detectedAt,
    this.resolvedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  double get riskScore => ((likelihood ?? 0.5) * (impact ?? 0.5)) * 100;

  factory AgriculturalRisk.fromJson(Map<String, dynamic> json) {
    return AgriculturalRisk(
      id: json['id'] as String,
      farmId: json['farmId'] as String,
      riskType: RiskType.values[json['riskType'] ?? 0],
      severity: RiskLevel.values[json['severity'] ?? 0],
      description: json['description'] as String,
      likelihood: (json['likelihood'] as num?)?.toDouble(),
      impact: (json['impact'] as num?)?.toDouble(),
      mitigation: json['mitigation'] as String?,
      isActive: json['isActive'] as bool? ?? true,
      detectedAt: json['detectedAt'] != null ? DateTime.parse(json['detectedAt'] as String) : null,
      resolvedAt: json['resolvedAt'] != null ? DateTime.parse(json['resolvedAt'] as String) : null,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmId': farmId,
    'riskType': riskType.index,
    'severity': severity.index,
    'description': description,
    'likelihood': likelihood,
    'impact': impact,
    'mitigation': mitigation,
    'isActive': isActive,
    'detectedAt': detectedAt?.toIso8601String(),
    'resolvedAt': resolvedAt?.toIso8601String(),
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== AGRI E-VOUCHER ==========

enum VoucherStatus { issued, active, used, expired, cancelled }
enum VoucherType { input, service, equipment, training }

class AgriculturalEVoucher {
  final String id;
  final String farmerId;
  final VoucherType voucherType;
  final VoucherStatus status;
  final double value;
  final String? description;
  final DateTime issuedAt;
  final DateTime expiresAt;
  final DateTime? usedAt;
  final String? usedWith; // Partner ID
  final String code;
  final bool isTransferable;
  final DateTime createdAt;
  final DateTime updatedAt;

  AgriculturalEVoucher({
    required this.id,
    required this.farmerId,
    required this.voucherType,
    required this.status,
    required this.value,
    this.description,
    required this.issuedAt,
    required this.expiresAt,
    this.usedAt,
    this.usedWith,
    required this.code,
    required this.isTransferable,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isExpired => DateTime.now().isAfter(expiresAt);
  bool get isUsable => status == VoucherStatus.active && !isExpired;
  String get formattedValue => '₦${value.toStringAsFixed(2)}';

  factory AgriculturalEVoucher.fromJson(Map<String, dynamic> json) {
    return AgriculturalEVoucher(
      id: json['id'] as String,
      farmerId: json['farmerId'] as String,
      voucherType: VoucherType.values[json['voucherType'] ?? 0],
      status: VoucherStatus.values[json['status'] ?? 0],
      value: (json['value'] as num?)?.toDouble() ?? 0.0,
      description: json['description'] as String?,
      issuedAt: DateTime.parse(json['issuedAt'] as String? ?? DateTime.now().toIso8601String()),
      expiresAt: DateTime.parse(json['expiresAt'] as String? ?? DateTime.now().toIso8601String()),
      usedAt: json['usedAt'] != null ? DateTime.parse(json['usedAt'] as String) : null,
      usedWith: json['usedWith'] as String?,
      code: json['code'] as String,
      isTransferable: json['isTransferable'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmerId': farmerId,
    'voucherType': voucherType.index,
    'status': status.index,
    'value': value,
    'description': description,
    'issuedAt': issuedAt.toIso8601String(),
    'expiresAt': expiresAt.toIso8601String(),
    'usedAt': usedAt?.toIso8601String(),
    'usedWith': usedWith,
    'code': code,
    'isTransferable': isTransferable,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== IOT SENSORS ==========

enum SensorType { temperature, humidity, soilMoisture, ph, nitrogen, rain, windSpeed }

class IoTSensor {
  final String id;
  final String farmId;
  final SensorType sensorType;
  final String name;
  final double latitude;
  final double longitude;
  final bool isActive;
  final String deviceId;
  final String? batteryLevel;
  final String? firmwareVersion;
  final DateTime lastReadingAt;
  final DateTime installedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  IoTSensor({
    required this.id,
    required this.farmId,
    required this.sensorType,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.isActive,
    required this.deviceId,
    this.batteryLevel,
    this.firmwareVersion,
    required this.lastReadingAt,
    required this.installedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory IoTSensor.fromJson(Map<String, dynamic> json) {
    return IoTSensor(
      id: json['id'] as String,
      farmId: json['farmId'] as String,
      sensorType: SensorType.values[json['sensorType'] ?? 0],
      name: json['name'] as String,
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      isActive: json['isActive'] as bool? ?? true,
      deviceId: json['deviceId'] as String,
      batteryLevel: json['batteryLevel'] as String?,
      firmwareVersion: json['firmwareVersion'] as String?,
      lastReadingAt: DateTime.parse(json['lastReadingAt'] as String? ?? DateTime.now().toIso8601String()),
      installedAt: DateTime.parse(json['installedAt'] as String? ?? DateTime.now().toIso8601String()),
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmId': farmId,
    'sensorType': sensorType.index,
    'name': name,
    'latitude': latitude,
    'longitude': longitude,
    'isActive': isActive,
    'deviceId': deviceId,
    'batteryLevel': batteryLevel,
    'firmwareVersion': firmwareVersion,
    'lastReadingAt': lastReadingAt.toIso8601String(),
    'installedAt': installedAt.toIso8601String(),
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

class SensorReading {
  final String id;
  final String sensorId;
  final double value;
  final String unit;
  final double? minThreshold;
  final double? maxThreshold;
  final bool isAnomalous;
  final DateTime recordedAt;

  SensorReading({
    required this.id,
    required this.sensorId,
    required this.value,
    required this.unit,
    this.minThreshold,
    this.maxThreshold,
    required this.isAnomalous,
    required this.recordedAt,
  });

  factory SensorReading.fromJson(Map<String, dynamic> json) {
    return SensorReading(
      id: json['id'] as String,
      sensorId: json['sensorId'] as String,
      value: (json['value'] as num?)?.toDouble() ?? 0.0,
      unit: json['unit'] as String,
      minThreshold: (json['minThreshold'] as num?)?.toDouble(),
      maxThreshold: (json['maxThreshold'] as num?)?.toDouble(),
      isAnomalous: json['isAnomalous'] as bool? ?? false,
      recordedAt: DateTime.parse(json['recordedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'sensorId': sensorId,
    'value': value,
    'unit': unit,
    'minThreshold': minThreshold,
    'maxThreshold': maxThreshold,
    'isAnomalous': isAnomalous,
    'recordedAt': recordedAt.toIso8601String(),
  };
}

// ========== AGRI LOGISTICS ==========

enum ShipmentStatus { pending, pickedUp, inTransit, delivered, cancelled }

class AgriculturalLogisticsShipment {
  final String id;
  final String farmerId;
  final String? marketplaceListingId;
  final ShipmentStatus status;
  final String origin;
  final String destination;
  final double weight; // kg
  final String? transporterName;
  final String? vehicleNumber;
  final double? trackingLatitude;
  final double? trackingLongitude;
  final DateTime? pickupTime;
  final DateTime? estimatedDelivery;
  final DateTime? actualDelivery;
  final double shippingCost;
  final String? insuranceProvider;
  final double? insuranceCost;
  final DateTime createdAt;
  final DateTime updatedAt;

  AgriculturalLogisticsShipment({
    required this.id,
    required this.farmerId,
    this.marketplaceListingId,
    required this.status,
    required this.origin,
    required this.destination,
    required this.weight,
    this.transporterName,
    this.vehicleNumber,
    this.trackingLatitude,
    this.trackingLongitude,
    this.pickupTime,
    this.estimatedDelivery,
    this.actualDelivery,
    required this.shippingCost,
    this.insuranceProvider,
    this.insuranceCost,
    required this.createdAt,
    required this.updatedAt,
  });

  String get formattedShippingCost => '₦${shippingCost.toStringAsFixed(2)}';
  int? get daysInTransit => actualDelivery != null && pickupTime != null
      ? actualDelivery!.difference(pickupTime!).inDays
      : null;

  factory AgriculturalLogisticsShipment.fromJson(Map<String, dynamic> json) {
    return AgriculturalLogisticsShipment(
      id: json['id'] as String,
      farmerId: json['farmerId'] as String,
      marketplaceListingId: json['marketplaceListingId'] as String?,
      status: ShipmentStatus.values[json['status'] ?? 0],
      origin: json['origin'] as String,
      destination: json['destination'] as String,
      weight: (json['weight'] as num?)?.toDouble() ?? 0.0,
      transporterName: json['transporterName'] as String?,
      vehicleNumber: json['vehicleNumber'] as String?,
      trackingLatitude: (json['trackingLatitude'] as num?)?.toDouble(),
      trackingLongitude: (json['trackingLongitude'] as num?)?.toDouble(),
      pickupTime: json['pickupTime'] != null ? DateTime.parse(json['pickupTime'] as String) : null,
      estimatedDelivery: json['estimatedDelivery'] != null ? DateTime.parse(json['estimatedDelivery'] as String) : null,
      actualDelivery: json['actualDelivery'] != null ? DateTime.parse(json['actualDelivery'] as String) : null,
      shippingCost: (json['shippingCost'] as num?)?.toDouble() ?? 0.0,
      insuranceProvider: json['insuranceProvider'] as String?,
      insuranceCost: (json['insuranceCost'] as num?)?.toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmerId': farmerId,
    'marketplaceListingId': marketplaceListingId,
    'status': status.index,
    'origin': origin,
    'destination': destination,
    'weight': weight,
    'transporterName': transporterName,
    'vehicleNumber': vehicleNumber,
    'trackingLatitude': trackingLatitude,
    'trackingLongitude': trackingLongitude,
    'pickupTime': pickupTime?.toIso8601String(),
    'estimatedDelivery': estimatedDelivery?.toIso8601String(),
    'actualDelivery': actualDelivery?.toIso8601String(),
    'shippingCost': shippingCost,
    'insuranceProvider': insuranceProvider,
    'insuranceCost': insuranceCost,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== SAVINGS CYCLES ==========

enum SavingsCycleStatus { forming, active, completed, closed }

class SavingsCycle {
  final String id;
  final String name;
  final String description;
  final SavingsCycleStatus status;
  final int memberCount;
  final double monthlyContribution;
  final int cycleDurationMonths;
  final int currentMonth;
  final String creatorId;
  final List<String> memberIds;
  final double totalPooledAmount;
  final DateTime createdAt;
  final DateTime cycleStartDate;
  final DateTime? cycleEndDate;
  final DateTime updatedAt;

  SavingsCycle({
    required this.id,
    required this.name,
    required this.description,
    required this.status,
    required this.memberCount,
    required this.monthlyContribution,
    required this.cycleDurationMonths,
    required this.currentMonth,
    required this.creatorId,
    required this.memberIds,
    required this.totalPooledAmount,
    required this.createdAt,
    required this.cycleStartDate,
    this.cycleEndDate,
    required this.updatedAt,
  });

  double get perMemberBalance => memberCount > 0 ? totalPooledAmount / memberCount : 0;
  int get remainingMonths => cycleDurationMonths - currentMonth;
  String get formattedPooledAmount => '₦${totalPooledAmount.toStringAsFixed(2)}';
  String get formattedMonthlyContribution => '₦${monthlyContribution.toStringAsFixed(2)}';

  factory SavingsCycle.fromJson(Map<String, dynamic> json) {
    return SavingsCycle(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      status: SavingsCycleStatus.values[json['status'] ?? 0],
      memberCount: json['memberCount'] as int? ?? 0,
      monthlyContribution: (json['monthlyContribution'] as num?)?.toDouble() ?? 0.0,
      cycleDurationMonths: json['cycleDurationMonths'] as int? ?? 12,
      currentMonth: json['currentMonth'] as int? ?? 1,
      creatorId: json['creatorId'] as String,
      memberIds: List<String>.from(json['memberIds'] ?? []),
      totalPooledAmount: (json['totalPooledAmount'] as num?)?.toDouble() ?? 0.0,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      cycleStartDate: DateTime.parse(json['cycleStartDate'] as String? ?? DateTime.now().toIso8601String()),
      cycleEndDate: json['cycleEndDate'] != null ? DateTime.parse(json['cycleEndDate'] as String) : null,
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'description': description,
    'status': status.index,
    'memberCount': memberCount,
    'monthlyContribution': monthlyContribution,
    'cycleDurationMonths': cycleDurationMonths,
    'currentMonth': currentMonth,
    'creatorId': creatorId,
    'memberIds': memberIds,
    'totalPooledAmount': totalPooledAmount,
    'createdAt': createdAt.toIso8601String(),
    'cycleStartDate': cycleStartDate.toIso8601String(),
    'cycleEndDate': cycleEndDate?.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== AGRI REINSURANCE ==========

enum ReinsuranceStatus { active, claimed, expired, cancelled }

class AgriculturalReinsurance {
  final String id;
  final String policyId; // Links to insurance policy
  final String farmerId;
  final ReinsuranceStatus status;
  final double coverageAmount;
  final double premium;
  final String reinsurer;
  final DateTime startDate;
  final DateTime endDate;
  final List<String>? coveredRisks;
  final int? claimsCount;
  final double? totalClaimed;
  final DateTime createdAt;
  final DateTime updatedAt;

  AgriculturalReinsurance({
    required this.id,
    required this.policyId,
    required this.farmerId,
    required this.status,
    required this.coverageAmount,
    required this.premium,
    required this.reinsurer,
    required this.startDate,
    required this.endDate,
    this.coveredRisks,
    this.claimsCount,
    this.totalClaimed,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isActive => DateTime.now().isBefore(endDate) && status == ReinsuranceStatus.active;
  String get formattedCoverageAmount => '₦${coverageAmount.toStringAsFixed(2)}';

  factory AgriculturalReinsurance.fromJson(Map<String, dynamic> json) {
    return AgriculturalReinsurance(
      id: json['id'] as String,
      policyId: json['policyId'] as String,
      farmerId: json['farmerId'] as String,
      status: ReinsuranceStatus.values[json['status'] ?? 0],
      coverageAmount: (json['coverageAmount'] as num?)?.toDouble() ?? 0.0,
      premium: (json['premium'] as num?)?.toDouble() ?? 0.0,
      reinsurer: json['reinsurer'] as String,
      startDate: DateTime.parse(json['startDate'] as String? ?? DateTime.now().toIso8601String()),
      endDate: DateTime.parse(json['endDate'] as String? ?? DateTime.now().toIso8601String()),
      coveredRisks: json['coveredRisks'] != null ? List<String>.from(json['coveredRisks']) : null,
      claimsCount: json['claimsCount'] as int?,
      totalClaimed: (json['totalClaimed'] as num?)?.toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'policyId': policyId,
    'farmerId': farmerId,
    'status': status.index,
    'coverageAmount': coverageAmount,
    'premium': premium,
    'reinsurer': reinsurer,
    'startDate': startDate.toIso8601String(),
    'endDate': endDate.toIso8601String(),
    'coveredRisks': coveredRisks,
    'claimsCount': claimsCount,
    'totalClaimed': totalClaimed,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== CROP YIELD PREDICTION ==========

class CropYieldPrediction {
  final String id;
  final String farmId;
  final String cropType;
  final double predictedYield; // in kg
  final double confidence; // 0-1
  final String? predictionModel;
  final List<String>? influencingFactors;
  final List<String>? recommendations;
  final DateTime predictionDate;
  final DateTime? harvestDate;
  final double? actualYield;
  final bool isHistorical;
  final DateTime createdAt;
  final DateTime updatedAt;

  CropYieldPrediction({
    required this.id,
    required this.farmId,
    required this.cropType,
    required this.predictedYield,
    required this.confidence,
    this.predictionModel,
    this.influencingFactors,
    this.recommendations,
    required this.predictionDate,
    this.harvestDate,
    this.actualYield,
    required this.isHistorical,
    required this.createdAt,
    required this.updatedAt,
  });

  double? get yieldAccuracy => actualYield != null 
      ? ((actualYield! / predictedYield) * 100) 
      : null;
  String get formattedPredictedYield => '${predictedYield.toStringAsFixed(1)} kg';
  String get confidencePercentage => '${(confidence * 100).toStringAsFixed(0)}%';

  factory CropYieldPrediction.fromJson(Map<String, dynamic> json) {
    return CropYieldPrediction(
      id: json['id'] as String,
      farmId: json['farmId'] as String,
      cropType: json['cropType'] as String,
      predictedYield: (json['predictedYield'] as num?)?.toDouble() ?? 0.0,
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0.5,
      predictionModel: json['predictionModel'] as String?,
      influencingFactors: json['influencingFactors'] != null 
          ? List<String>.from(json['influencingFactors']) 
          : null,
      recommendations: json['recommendations'] != null 
          ? List<String>.from(json['recommendations']) 
          : null,
      predictionDate: DateTime.parse(json['predictionDate'] as String? ?? DateTime.now().toIso8601String()),
      harvestDate: json['harvestDate'] != null ? DateTime.parse(json['harvestDate'] as String) : null,
      actualYield: (json['actualYield'] as num?)?.toDouble(),
      isHistorical: json['isHistorical'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmId': farmId,
    'cropType': cropType,
    'predictedYield': predictedYield,
    'confidence': confidence,
    'predictionModel': predictionModel,
    'influencingFactors': influencingFactors,
    'recommendations': recommendations,
    'predictionDate': predictionDate.toIso8601String(),
    'harvestDate': harvestDate?.toIso8601String(),
    'actualYield': actualYield,
    'isHistorical': isHistorical,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== FARM BOUNDARY MAPPING ==========

class FarmBoundaryMapping {
  final String id;
  final String farmId;
  final List<Map<String, double>> gpsCoordinates; // [{lat, lng}, ...]
  final double boundaryAreaHectares;
  final String? mappingMethod; // GPS, Satellite, Manual, etc.
  final DateTime mappedAt;
  final bool isVerified;
  final String? verifiedBy;
  final DateTime? verificationDate;
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;

  FarmBoundaryMapping({
    required this.id,
    required this.farmId,
    required this.gpsCoordinates,
    required this.boundaryAreaHectares,
    this.mappingMethod,
    required this.mappedAt,
    required this.isVerified,
    this.verifiedBy,
    this.verificationDate,
    this.notes,
    required this.createdAt,
    required this.updatedAt,
  });

  factory FarmBoundaryMapping.fromJson(Map<String, dynamic> json) {
    List<Map<String, double>> coords = [];
    if (json['gpsCoordinates'] != null) {
      coords = List<Map<String, double>>.from(
        (json['gpsCoordinates'] as List).map((c) => {
          'lat': (c['lat'] as num?)?.toDouble() ?? 0.0,
          'lng': (c['lng'] as num?)?.toDouble() ?? 0.0,
        })
      );
    }
    
    return FarmBoundaryMapping(
      id: json['id'] as String,
      farmId: json['farmId'] as String,
      gpsCoordinates: coords,
      boundaryAreaHectares: (json['boundaryAreaHectares'] as num?)?.toDouble() ?? 0.0,
      mappingMethod: json['mappingMethod'] as String?,
      mappedAt: DateTime.parse(json['mappedAt'] as String? ?? DateTime.now().toIso8601String()),
      isVerified: json['isVerified'] as bool? ?? false,
      verifiedBy: json['verifiedBy'] as String?,
      verificationDate: json['verificationDate'] != null 
          ? DateTime.parse(json['verificationDate'] as String) 
          : null,
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmId': farmId,
    'gpsCoordinates': gpsCoordinates,
    'boundaryAreaHectares': boundaryAreaHectares,
    'mappingMethod': mappingMethod,
    'mappedAt': mappedAt.toIso8601String(),
    'isVerified': isVerified,
    'verifiedBy': verifiedBy,
    'verificationDate': verificationDate?.toIso8601String(),
    'notes': notes,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== SATELLITE MONITOR ==========

enum SatelliteDataType { ndvi, ndbi, ndmi, thermal, rgb }

class SatelliteMonitoringData {
  final String id;
  final String farmId;
  final SatelliteDataType dataType;
  final String? provider; // e.g., Sentinel-2, Landsat-8
  final double value;
  final String? imageUrl;
  final DateTime capturedAt;
  final String? analysisNotes;
  final List<String>? anomalies;
  final DateTime createdAt;
  final DateTime updatedAt;

  SatelliteMonitoringData({
    required this.id,
    required this.farmId,
    required this.dataType,
    this.provider,
    required this.value,
    this.imageUrl,
    required this.capturedAt,
    this.analysisNotes,
    this.anomalies,
    required this.createdAt,
    required this.updatedAt,
  });

  factory SatelliteMonitoringData.fromJson(Map<String, dynamic> json) {
    return SatelliteMonitoringData(
      id: json['id'] as String,
      farmId: json['farmId'] as String,
      dataType: SatelliteDataType.values[json['dataType'] ?? 0],
      provider: json['provider'] as String?,
      value: (json['value'] as num?)?.toDouble() ?? 0.0,
      imageUrl: json['imageUrl'] as String?,
      capturedAt: DateTime.parse(json['capturedAt'] as String? ?? DateTime.now().toIso8601String()),
      analysisNotes: json['analysisNotes'] as String?,
      anomalies: json['anomalies'] != null 
          ? List<String>.from(json['anomalies']) 
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmId': farmId,
    'dataType': dataType.index,
    'provider': provider,
    'value': value,
    'imageUrl': imageUrl,
    'capturedAt': capturedAt.toIso8601String(),
    'analysisNotes': analysisNotes,
    'anomalies': anomalies,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== SOIL ANALYSIS ==========

enum SoilType { clay, loam, sandy, silty, organic }

class SoilAnalysis {
  final String id;
  final String farmId;
  final SoilType soilType;
  final double phLevel;
  final double nitrogenPpm;
  final double phosphorusPpm;
  final double potassiumPpm;
  final double organicMatter; // percentage
  final double cationExchangeCapacity; // CEC
  final String? texture;
  final String? recommendations;
  final DateTime testDate;
  final DateTime? nextTestDate;
  final DateTime createdAt;
  final DateTime updatedAt;

  SoilAnalysis({
    required this.id,
    required this.farmId,
    required this.soilType,
    required this.phLevel,
    required this.nitrogenPpm,
    required this.phosphorusPpm,
    required this.potassiumPpm,
    required this.organicMatter,
    required this.cationExchangeCapacity,
    this.texture,
    this.recommendations,
    required this.testDate,
    this.nextTestDate,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get phIsOptimal => phLevel >= 6.0 && phLevel <= 7.5;
  String get soilTypeName => soilType.toString().split('.').last;

  factory SoilAnalysis.fromJson(Map<String, dynamic> json) {
    return SoilAnalysis(
      id: json['id'] as String,
      farmId: json['farmId'] as String,
      soilType: SoilType.values[json['soilType'] ?? 0],
      phLevel: (json['phLevel'] as num?)?.toDouble() ?? 7.0,
      nitrogenPpm: (json['nitrogenPpm'] as num?)?.toDouble() ?? 0.0,
      phosphorusPpm: (json['phosphorusPpm'] as num?)?.toDouble() ?? 0.0,
      potassiumPpm: (json['potassiumPpm'] as num?)?.toDouble() ?? 0.0,
      organicMatter: (json['organicMatter'] as num?)?.toDouble() ?? 0.0,
      cationExchangeCapacity: (json['cationExchangeCapacity'] as num?)?.toDouble() ?? 0.0,
      texture: json['texture'] as String?,
      recommendations: json['recommendations'] as String?,
      testDate: DateTime.parse(json['testDate'] as String? ?? DateTime.now().toIso8601String()),
      nextTestDate: json['nextTestDate'] != null 
          ? DateTime.parse(json['nextTestDate'] as String) 
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmId': farmId,
    'soilType': soilType.index,
    'phLevel': phLevel,
    'nitrogenPpm': nitrogenPpm,
    'phosphorusPpm': phosphorusPpm,
    'potassiumPpm': potassiumPpm,
    'organicMatter': organicMatter,
    'cationExchangeCapacity': cationExchangeCapacity,
    'texture': texture,
    'recommendations': recommendations,
    'testDate': testDate.toIso8601String(),
    'nextTestDate': nextTestDate?.toIso8601String(),
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== LIVESTOCK FINANCE ==========

enum LivestockType { cattle, goat, sheep, pig, poultry, aquaculture }

class LivestockFinance {
  final String id;
  final String farmerId;
  final LivestockType livestockType;
  final int quantity;
  final double totalValue;
  final double loanAmount;
  final double interestRate;
  final int loanTermMonths;
  final double monthlyPayment;
  final String purpose; // Breeding, Fattening, Dairy, etc.
  final DateTime financeStartDate;
  final DateTime expectedCompletionDate;
  final double projectedReturn;
  final DateTime createdAt;
  final DateTime updatedAt;

  LivestockFinance({
    required this.id,
    required this.farmerId,
    required this.livestockType,
    required this.quantity,
    required this.totalValue,
    required this.loanAmount,
    required this.interestRate,
    required this.loanTermMonths,
    required this.monthlyPayment,
    required this.purpose,
    required this.financeStartDate,
    required this.expectedCompletionDate,
    required this.projectedReturn,
    required this.createdAt,
    required this.updatedAt,
  });

  double get projectedProfit => projectedReturn - loanAmount;
  String get formattedLoanAmount => '₦${loanAmount.toStringAsFixed(2)}';
  String get formattedMonthlyPayment => '₦${monthlyPayment.toStringAsFixed(2)}';

  factory LivestockFinance.fromJson(Map<String, dynamic> json) {
    return LivestockFinance(
      id: json['id'] as String,
      farmerId: json['farmerId'] as String,
      livestockType: LivestockType.values[json['livestockType'] ?? 0],
      quantity: json['quantity'] as int? ?? 0,
      totalValue: (json['totalValue'] as num?)?.toDouble() ?? 0.0,
      loanAmount: (json['loanAmount'] as num?)?.toDouble() ?? 0.0,
      interestRate: (json['interestRate'] as num?)?.toDouble() ?? 0.0,
      loanTermMonths: json['loanTermMonths'] as int? ?? 12,
      monthlyPayment: (json['monthlyPayment'] as num?)?.toDouble() ?? 0.0,
      purpose: json['purpose'] as String,
      financeStartDate: DateTime.parse(json['financeStartDate'] as String? ?? DateTime.now().toIso8601String()),
      expectedCompletionDate: DateTime.parse(json['expectedCompletionDate'] as String? ?? DateTime.now().toIso8601String()),
      projectedReturn: (json['projectedReturn'] as num?)?.toDouble() ?? 0.0,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmerId': farmerId,
    'livestockType': livestockType.index,
    'quantity': quantity,
    'totalValue': totalValue,
    'loanAmount': loanAmount,
    'interestRate': interestRate,
    'loanTermMonths': loanTermMonths,
    'monthlyPayment': monthlyPayment,
    'purpose': purpose,
    'financeStartDate': financeStartDate.toIso8601String(),
    'expectedCompletionDate': expectedCompletionDate.toIso8601String(),
    'projectedReturn': projectedReturn,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== LIVESTOCK MANAGEMENT ==========

enum AnimalHealthStatus { healthy, sick, vaccinated, treated, quarantined }

class LivestockRecord {
  final String id;
  final String farmerId;
  final String livestockId;
  final LivestockType type;
  final String? breed;
  final DateTime dateOfBirth;
  final double? weight; // kg
  final AnimalHealthStatus healthStatus;
  final List<String>? vaccinations;
  final List<String>? treatments;
  final String? feedType;
  final double? dailyFeedQuantity;
  final double? expectedYield; // For dairy/eggs
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;

  LivestockRecord({
    required this.id,
    required this.farmerId,
    required this.livestockId,
    required this.type,
    this.breed,
    required this.dateOfBirth,
    this.weight,
    required this.healthStatus,
    this.vaccinations,
    this.treatments,
    this.feedType,
    this.dailyFeedQuantity,
    this.expectedYield,
    this.notes,
    required this.createdAt,
    required this.updatedAt,
  });

  int? get ageInMonths {
    final now = DateTime.now();
    return ((now.year - dateOfBirth.year) * 12) + (now.month - dateOfBirth.month);
  }

  factory LivestockRecord.fromJson(Map<String, dynamic> json) {
    return LivestockRecord(
      id: json['id'] as String,
      farmerId: json['farmerId'] as String,
      livestockId: json['livestockId'] as String,
      type: LivestockType.values[json['type'] ?? 0],
      breed: json['breed'] as String?,
      dateOfBirth: DateTime.parse(json['dateOfBirth'] as String? ?? DateTime.now().toIso8601String()),
      weight: (json['weight'] as num?)?.toDouble(),
      healthStatus: AnimalHealthStatus.values[json['healthStatus'] ?? 0],
      vaccinations: json['vaccinations'] != null 
          ? List<String>.from(json['vaccinations']) 
          : null,
      treatments: json['treatments'] != null 
          ? List<String>.from(json['treatments']) 
          : null,
      feedType: json['feedType'] as String?,
      dailyFeedQuantity: (json['dailyFeedQuantity'] as num?)?.toDouble(),
      expectedYield: (json['expectedYield'] as num?)?.toDouble(),
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmerId': farmerId,
    'livestockId': livestockId,
    'type': type.index,
    'breed': breed,
    'dateOfBirth': dateOfBirth.toIso8601String(),
    'weight': weight,
    'healthStatus': healthStatus.index,
    'vaccinations': vaccinations,
    'treatments': treatments,
    'feedType': feedType,
    'dailyFeedQuantity': dailyFeedQuantity,
    'expectedYield': expectedYield,
    'notes': notes,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== COMMODITY EXCHANGE ==========

enum CommodityCategory { grain, fiber, spice, oil, meat, dairy, aquatic }

class CommodityExchangeListing {
  final String id;
  final String supplierId;
  final CommodityCategory category;
  final String commodityName;
  final double quantity; // in tonnes
  final String unit;
  final double pricePerUnit;
  final double totalValue;
  final String? qualityGrade;
  final DateTime availableFrom;
  final DateTime availableUntil;
  final String location;
  final bool isActive;
  final List<String>? buyerIds;
  final DateTime createdAt;
  final DateTime updatedAt;

  CommodityExchangeListing({
    required this.id,
    required this.supplierId,
    required this.category,
    required this.commodityName,
    required this.quantity,
    required this.unit,
    required this.pricePerUnit,
    required this.totalValue,
    this.qualityGrade,
    required this.availableFrom,
    required this.availableUntil,
    required this.location,
    required this.isActive,
    this.buyerIds,
    required this.createdAt,
    required this.updatedAt,
  });

  String get formattedPricePerUnit => '₦${pricePerUnit.toStringAsFixed(2)}';
  String get formattedTotalValue => '₦${totalValue.toStringAsFixed(2)}';
  bool get isExpired => DateTime.now().isAfter(availableUntil);

  factory CommodityExchangeListing.fromJson(Map<String, dynamic> json) {
    return CommodityExchangeListing(
      id: json['id'] as String,
      supplierId: json['supplierId'] as String,
      category: CommodityCategory.values[json['category'] ?? 0],
      commodityName: json['commodityName'] as String,
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0.0,
      unit: json['unit'] as String,
      pricePerUnit: (json['pricePerUnit'] as num?)?.toDouble() ?? 0.0,
      totalValue: (json['totalValue'] as num?)?.toDouble() ?? 0.0,
      qualityGrade: json['qualityGrade'] as String?,
      availableFrom: DateTime.parse(json['availableFrom'] as String? ?? DateTime.now().toIso8601String()),
      availableUntil: DateTime.parse(json['availableUntil'] as String? ?? DateTime.now().toIso8601String()),
      location: json['location'] as String,
      isActive: json['isActive'] as bool? ?? true,
      buyerIds: json['buyerIds'] != null 
          ? List<String>.from(json['buyerIds']) 
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'supplierId': supplierId,
    'category': category.index,
    'commodityName': commodityName,
    'quantity': quantity,
    'unit': unit,
    'pricePerUnit': pricePerUnit,
    'totalValue': totalValue,
    'qualityGrade': qualityGrade,
    'availableFrom': availableFrom.toIso8601String(),
    'availableUntil': availableUntil.toIso8601String(),
    'location': location,
    'isActive': isActive,
    'buyerIds': buyerIds,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== WAREHOUSE MANAGEMENT ==========

enum WarehouseFacilityType { grain, cold, general, specialized }

class WarehouseFacility {
  final String id;
  final String name;
  final String location;
  final WarehouseFacilityType type;
  final double capacityTonnes;
  final double occupiedTonnes;
  final String operatorName;
  final String contactPhone;
  final String? certifications;
  final double? dailyStorageCost;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  WarehouseFacility({
    required this.id,
    required this.name,
    required this.location,
    required this.type,
    required this.capacityTonnes,
    required this.occupiedTonnes,
    required this.operatorName,
    required this.contactPhone,
    this.certifications,
    this.dailyStorageCost,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
  });

  double get availableCapacity => capacityTonnes - occupiedTonnes;
  double get occupancyPercentage => (occupiedTonnes / capacityTonnes) * 100;
  String get occupancyStatus => occupancyPercentage > 80 
      ? 'High' 
      : occupancyPercentage > 50 
          ? 'Medium' 
          : 'Low';

  factory WarehouseFacility.fromJson(Map<String, dynamic> json) {
    return WarehouseFacility(
      id: json['id'] as String,
      name: json['name'] as String,
      location: json['location'] as String,
      type: WarehouseFacilityType.values[json['type'] ?? 0],
      capacityTonnes: (json['capacityTonnes'] as num?)?.toDouble() ?? 0.0,
      occupiedTonnes: (json['occupiedTonnes'] as num?)?.toDouble() ?? 0.0,
      operatorName: json['operatorName'] as String,
      contactPhone: json['contactPhone'] as String,
      certifications: json['certifications'] as String?,
      dailyStorageCost: (json['dailyStorageCost'] as num?)?.toDouble(),
      isActive: json['isActive'] as bool? ?? true,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'location': location,
    'type': type.index,
    'capacityTonnes': capacityTonnes,
    'occupiedTonnes': occupiedTonnes,
    'operatorName': operatorName,
    'contactPhone': contactPhone,
    'certifications': certifications,
    'dailyStorageCost': dailyStorageCost,
    'isActive': isActive,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

class WarehouseStorage {
  final String id;
  final String warehouseId;
  final String farmerId;
  final String? commodityType;
  final double quantity; // tonnes
  final DateTime storageStartDate;
  final DateTime? expectedRemovalDate;
  final DateTime? actualRemovalDate;
  final double? totalStorageCost;
  final String? storageConditions;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  WarehouseStorage({
    required this.id,
    required this.warehouseId,
    required this.farmerId,
    this.commodityType,
    required this.quantity,
    required this.storageStartDate,
    this.expectedRemovalDate,
    this.actualRemovalDate,
    this.totalStorageCost,
    this.storageConditions,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
  });

  int? get storageDaysUsed => actualRemovalDate != null
      ? actualRemovalDate!.difference(storageStartDate).inDays
      : DateTime.now().difference(storageStartDate).inDays;

  factory WarehouseStorage.fromJson(Map<String, dynamic> json) {
    return WarehouseStorage(
      id: json['id'] as String,
      warehouseId: json['warehouseId'] as String,
      farmerId: json['farmerId'] as String,
      commodityType: json['commodityType'] as String?,
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0.0,
      storageStartDate: DateTime.parse(json['storageStartDate'] as String? ?? DateTime.now().toIso8601String()),
      expectedRemovalDate: json['expectedRemovalDate'] != null 
          ? DateTime.parse(json['expectedRemovalDate'] as String) 
          : null,
      actualRemovalDate: json['actualRemovalDate'] != null 
          ? DateTime.parse(json['actualRemovalDate'] as String) 
          : null,
      totalStorageCost: (json['totalStorageCost'] as num?)?.toDouble(),
      storageConditions: json['storageConditions'] as String?,
      isActive: json['isActive'] as bool? ?? true,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'warehouseId': warehouseId,
    'farmerId': farmerId,
    'commodityType': commodityType,
    'quantity': quantity,
    'storageStartDate': storageStartDate.toIso8601String(),
    'expectedRemovalDate': expectedRemovalDate?.toIso8601String(),
    'actualRemovalDate': actualRemovalDate?.toIso8601String(),
    'totalStorageCost': totalStorageCost,
    'storageConditions': storageConditions,
    'isActive': isActive,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== CBN AGRI RETURNS ==========

class CBNAgriculturalReturns {
  final String id;
  final String farmerId;
  final int reportingYear;
  final String reportingPeriod; // Q1, Q2, Q3, Q4
  final double grossProductionValue;
  final double totalCostOfProduction;
  final double netFarmIncome;
  final double yieldPerHectare;
  final double harvestedArea;
  final Map<String, double> cropsYield; // crop -> yield
  final String? submissionStatus; // Draft, Submitted, Verified
  final DateTime? submissionDate;
  final String? verificationStatus;
  final String? verifiedBy;
  final DateTime createdAt;
  final DateTime updatedAt;

  CBNAgriculturalReturns({
    required this.id,
    required this.farmerId,
    required this.reportingYear,
    required this.reportingPeriod,
    required this.grossProductionValue,
    required this.totalCostOfProduction,
    required this.netFarmIncome,
    required this.yieldPerHectare,
    required this.harvestedArea,
    required this.cropsYield,
    this.submissionStatus,
    this.submissionDate,
    this.verificationStatus,
    this.verifiedBy,
    required this.createdAt,
    required this.updatedAt,
  });

  double get profitMargin => grossProductionValue > 0
      ? ((netFarmIncome / grossProductionValue) * 100)
      : 0;
  String get formattedGrosValue => '₦${grossProductionValue.toStringAsFixed(2)}';

  factory CBNAgriculturalReturns.fromJson(Map<String, dynamic> json) {
    return CBNAgriculturalReturns(
      id: json['id'] as String,
      farmerId: json['farmerId'] as String,
      reportingYear: json['reportingYear'] as int? ?? DateTime.now().year,
      reportingPeriod: json['reportingPeriod'] as String,
      grossProductionValue: (json['grossProductionValue'] as num?)?.toDouble() ?? 0.0,
      totalCostOfProduction: (json['totalCostOfProduction'] as num?)?.toDouble() ?? 0.0,
      netFarmIncome: (json['netFarmIncome'] as num?)?.toDouble() ?? 0.0,
      yieldPerHectare: (json['yieldPerHectare'] as num?)?.toDouble() ?? 0.0,
      harvestedArea: (json['harvestedArea'] as num?)?.toDouble() ?? 0.0,
      cropsYield: Map<String, double>.from(
        (json['cropsYield'] as Map<String, dynamic>?)?.map((k, v) => 
          MapEntry(k, (v as num?)?.toDouble() ?? 0.0)
        ) ?? {}
      ),
      submissionStatus: json['submissionStatus'] as String?,
      submissionDate: json['submissionDate'] != null 
          ? DateTime.parse(json['submissionDate'] as String) 
          : null,
      verificationStatus: json['verificationStatus'] as String?,
      verifiedBy: json['verifiedBy'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmerId': farmerId,
    'reportingYear': reportingYear,
    'reportingPeriod': reportingPeriod,
    'grossProductionValue': grossProductionValue,
    'totalCostOfProduction': totalCostOfProduction,
    'netFarmIncome': netFarmIncome,
    'yieldPerHectare': yieldPerHectare,
    'harvestedArea': harvestedArea,
    'cropsYield': cropsYield,
    'submissionStatus': submissionStatus,
    'submissionDate': submissionDate?.toIso8601String(),
    'verificationStatus': verificationStatus,
    'verifiedBy': verifiedBy,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== NIRSAL AGROGEO COOP ==========

class NIRSALAgroCoop {
  final String id;
  final String name;
  final String location;
  final int memberCount;
  final String registrationNumber;
  final bool isNirsalMember;
  final double? guaranteeCoveragePercentage;
  final double? totalLoanPortfolio;
  final List<String> memberFarmerIds;
  final String operatorName;
  final String contactPhone;
  final bool isActive;
  final DateTime registeredAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  NIRSALAgroCoop({
    required this.id,
    required this.name,
    required this.location,
    required this.memberCount,
    required this.registrationNumber,
    required this.isNirsalMember,
    this.guaranteeCoveragePercentage,
    this.totalLoanPortfolio,
    required this.memberFarmerIds,
    required this.operatorName,
    required this.contactPhone,
    required this.isActive,
    required this.registeredAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory NIRSALAgroCoop.fromJson(Map<String, dynamic> json) {
    return NIRSALAgroCoop(
      id: json['id'] as String,
      name: json['name'] as String,
      location: json['location'] as String,
      memberCount: json['memberCount'] as int? ?? 0,
      registrationNumber: json['registrationNumber'] as String,
      isNirsalMember: json['isNirsalMember'] as bool? ?? false,
      guaranteeCoveragePercentage: (json['guaranteeCoveragePercentage'] as num?)?.toDouble(),
      totalLoanPortfolio: (json['totalLoanPortfolio'] as num?)?.toDouble(),
      memberFarmerIds: List<String>.from(json['memberFarmerIds'] ?? []),
      operatorName: json['operatorName'] as String,
      contactPhone: json['contactPhone'] as String,
      isActive: json['isActive'] as bool? ?? true,
      registeredAt: DateTime.parse(json['registeredAt'] as String? ?? DateTime.now().toIso8601String()),
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'location': location,
    'memberCount': memberCount,
    'registrationNumber': registrationNumber,
    'isNirsalMember': isNirsalMember,
    'guaranteeCoveragePercentage': guaranteeCoveragePercentage,
    'totalLoanPortfolio': totalLoanPortfolio,
    'memberFarmerIds': memberFarmerIds,
    'operatorName': operatorName,
    'contactPhone': contactPhone,
    'isActive': isActive,
    'registeredAt': registeredAt.toIso8601String(),
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}

// ========== ANCHOR BORROWERS ==========

enum AnchorBorrowerStatus { applied, approved, active, completed, defaulted }

class AnchorBorrowerProgram {
  final String id;
  final String farmerId;
  final String anchorCompanyName;
  final String anchorCompanyId;
  final AnchorBorrowerStatus status;
  final String contract;
  final double loanAmount;
  final double interestRate;
  final int loanTermMonths;
  final List<String>? productsToSupply; // [crop names]
  final double? expectedProduction;
  final double? minimumPriceGuarantee;
  final DateTime? estimatedHarvestDate;
  final double? agreedYieldTarget;
  final DateTime startDate;
  final DateTime? endDate;
  final DateTime createdAt;
  final DateTime updatedAt;

  AnchorBorrowerProgram({
    required this.id,
    required this.farmerId,
    required this.anchorCompanyName,
    required this.anchorCompanyId,
    required this.status,
    required this.contract,
    required this.loanAmount,
    required this.interestRate,
    required this.loanTermMonths,
    this.productsToSupply,
    this.expectedProduction,
    this.minimumPriceGuarantee,
    this.estimatedHarvestDate,
    this.agreedYieldTarget,
    required this.startDate,
    this.endDate,
    required this.createdAt,
    required this.updatedAt,
  });

  String get formattedLoanAmount => '₦${loanAmount.toStringAsFixed(2)}';
  String get formattedMinimumPrice => minimumPriceGuarantee != null 
      ? '₦${minimumPriceGuarantee!.toStringAsFixed(2)}'
      : 'N/A';

  factory AnchorBorrowerProgram.fromJson(Map<String, dynamic> json) {
    return AnchorBorrowerProgram(
      id: json['id'] as String,
      farmerId: json['farmerId'] as String,
      anchorCompanyName: json['anchorCompanyName'] as String,
      anchorCompanyId: json['anchorCompanyId'] as String,
      status: AnchorBorrowerStatus.values[json['status'] ?? 0],
      contract: json['contract'] as String,
      loanAmount: (json['loanAmount'] as num?)?.toDouble() ?? 0.0,
      interestRate: (json['interestRate'] as num?)?.toDouble() ?? 0.0,
      loanTermMonths: json['loanTermMonths'] as int? ?? 12,
      productsToSupply: json['productsToSupply'] != null 
          ? List<String>.from(json['productsToSupply']) 
          : null,
      expectedProduction: (json['expectedProduction'] as num?)?.toDouble(),
      minimumPriceGuarantee: (json['minimumPriceGuarantee'] as num?)?.toDouble(),
      estimatedHarvestDate: json['estimatedHarvestDate'] != null 
          ? DateTime.parse(json['estimatedHarvestDate'] as String) 
          : null,
      agreedYieldTarget: (json['agreedYieldTarget'] as num?)?.toDouble(),
      startDate: DateTime.parse(json['startDate'] as String? ?? DateTime.now().toIso8601String()),
      endDate: json['endDate'] != null 
          ? DateTime.parse(json['endDate'] as String) 
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'farmerId': farmerId,
    'anchorCompanyName': anchorCompanyName,
    'anchorCompanyId': anchorCompanyId,
    'status': status.index,
    'contract': contract,
    'loanAmount': loanAmount,
    'interestRate': interestRate,
    'loanTermMonths': loanTermMonths,
    'productsToSupply': productsToSupply,
    'expectedProduction': expectedProduction,
    'minimumPriceGuarantee': minimumPriceGuarantee,
    'estimatedHarvestDate': estimatedHarvestDate?.toIso8601String(),
    'agreedYieldTarget': agreedYieldTarget,
    'startDate': startDate.toIso8601String(),
    'endDate': endDate?.toIso8601String(),
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };
}
