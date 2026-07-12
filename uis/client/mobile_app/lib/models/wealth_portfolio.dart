class WealthPortfolio {
  final String id;
  final String portfolioRef;
  final String clientId;
  final String clientName;
  final double aum;
  final String currency;
  final String strategy;
  final double? ytdReturn;
  final String riskProfile;
  final String? relationshipManagerId;
  final String? relationshipManagerName;
  final Map<String, dynamic>? assetAllocation;
  final String status;
  final String createdAt;
  final String? updatedAt;

  WealthPortfolio({
    required this.id,
    required this.portfolioRef,
    required this.clientId,
    required this.clientName,
    required this.aum,
    this.currency = 'NGN',
    required this.strategy,
    this.ytdReturn,
    this.riskProfile = 'moderate',
    this.relationshipManagerId,
    this.relationshipManagerName,
    this.assetAllocation,
    required this.status,
    required this.createdAt,
    this.updatedAt,
  });

  factory WealthPortfolio.fromJson(Map<String, dynamic> json) {
    return WealthPortfolio(
      id: (json['id'] ?? '').toString(),
      portfolioRef: (json['portfolio_ref'] ?? json['portfolioRef'] ?? '').toString(),
      clientId: (json['client_id'] ?? json['clientId'] ?? '').toString(),
      clientName: (json['client_name'] ?? json['clientName'] ?? '').toString(),
      aum: (json['aum'] ?? 0).toDouble(),
      currency: (json['currency'] ?? 'NGN').toString(),
      strategy: (json['strategy'] ?? 'balanced').toString(),
      ytdReturn: json['ytd_return'] != null ? (json['ytd_return']).toDouble() : null,
      riskProfile: (json['risk_profile'] ?? json['riskProfile'] ?? 'moderate').toString(),
      relationshipManagerId: json['rm_id']?.toString() ?? json['relationshipManagerId']?.toString(),
      relationshipManagerName: json['rm_name']?.toString() ?? json['relationshipManagerName']?.toString(),
      assetAllocation: json['asset_allocation'] is Map
          ? Map<String, dynamic>.from(json['asset_allocation'])
          : null,
      status: (json['status'] ?? 'active').toString(),
      createdAt: (json['created_at'] ?? json['createdAt'] ?? '').toString(),
      updatedAt: json['updated_at']?.toString() ?? json['updatedAt']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'portfolio_ref': portfolioRef,
        'client_id': clientId,
        'client_name': clientName,
        'aum': aum,
        'currency': currency,
        'strategy': strategy,
        if (ytdReturn != null) 'ytd_return': ytdReturn,
        'risk_profile': riskProfile,
        if (relationshipManagerId != null) 'rm_id': relationshipManagerId,
        if (assetAllocation != null) 'asset_allocation': assetAllocation,
        'status': status,
        'created_at': createdAt,
        if (updatedAt != null) 'updated_at': updatedAt,
      };

  String get formattedAum {
    final symbol = currency == 'NGN' ? '₦' : currency;
    if (aum >= 1e9) return '$symbol${(aum / 1e9).toStringAsFixed(1)}B';
    if (aum >= 1e6) return '$symbol${(aum / 1e6).toStringAsFixed(1)}M';
    return '$symbol${aum.toStringAsFixed(2)}';
  }

  String get formattedYtdReturn {
    if (ytdReturn == null) return 'N/A';
    final sign = ytdReturn! >= 0 ? '+' : '';
    return '$sign${ytdReturn!.toStringAsFixed(1)}%';
  }
}
