class TenantConfig {
  final String id;
  final String name;
  final String displayName;
  final String tenantId;
  final String status;
  final String domain;
  final String logo;
  final String favicon;
  final ContactInfo contact;
  final BrandingInfo branding;
  final List<FeatureFlag> featureFlags;
  final TenantFeatures features;
  final TenantMetadata? metadata;

  TenantConfig({
    required this.id,
    required this.name,
    required this.displayName,
    required this.tenantId,
    required this.status,
    required this.domain,
    required this.logo,
    required this.favicon,
    required this.contact,
    required this.branding,
    required this.featureFlags,
    required this.features,
    this.metadata,
  });

  factory TenantConfig.fromJson(Map<String, dynamic> json) {
    final featureFlags = (json['feature_flags'] as List<dynamic>?)
        ?.map((flag) => FeatureFlag.fromJson(flag as Map<String, dynamic>))
        .toList() ?? [];
    
    // Convert feature flags to features map
    final features = TenantFeatures.fromFeatureFlags(featureFlags);
    
    final brandingJson = json['branding'] as Map<String, dynamic>?;
    final branding = brandingJson != null
        ? BrandingInfo.fromJson(brandingJson)
        : BrandingInfo(logoUrl: '', faviconUrl: '', primary_color: '#1A73E8', secondary_color: '#00C853', domain: '');

    final contactJson = json['contact'] as Map<String, dynamic>?;
    final contact = contactJson != null
        ? ContactInfo.fromJson(contactJson)
        : ContactInfo(email: '', phone: '');

    return TenantConfig(
      id: json['id']?.toString() ?? json['tenant_id'] as String,
      name: json['name'] as String,
      displayName: json['display_name'] as String? ?? json['name'] as String,
      tenantId: json['tenant_id'] as String,
      status: json['status'] as String,
      domain: branding.domain,
      logo: branding.logoUrl,
      favicon: branding.faviconUrl,
      contact: contact,
      branding: branding,
      featureFlags: featureFlags,
      features: features,
      metadata: json['metadata'] != null 
        ? TenantMetadata.fromJson(json['metadata'] as Map<String, dynamic>)
        : json['created_at'] != null
          ? TenantMetadata(
              createdAt: DateTime.parse(json['created_at'] as String),
              updatedAt: DateTime.parse(json['updated_at'] as String),
              deletedAt: json['deleted_at'] != null 
                ? DateTime.parse(json['deleted_at'] as String)
                : null,
            )
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'display_name': displayName,
      'tenant_id': tenantId,
      'status': status,
      'domain': domain,
      'logo': logo,
      'favicon': favicon,
      'contact': contact.toJson(),
      'branding': branding.toJson(),
      'feature_flags': featureFlags.map((f) => f.toJson()).toList(),
      'metadata': metadata?.toJson(),
    };
  }

  bool isFeatureEnabled(String featureName) {
    // Handle legacy "enable*" format - convert to snake_case
    String normalizedFeature = featureName;
    if (featureName.startsWith('enable')) {
      // enableCards -> cards, enableLPO -> lpo
      normalizedFeature = featureName.replaceFirst('enable', '').toLowerCase();
      // Also try with underscores: enableCarbonCredits -> carbon_credits
      final withUnderscores = featureName
          .replaceFirst('enable', '')
          .replaceAllMapped(RegExp(r'([A-Z])'), (m) => '_${m.group(1)!.toLowerCase()}')
          .replaceFirst('_', '');
      
      // Check direct feature flag lookup
      final directMatch = featureFlags.where((f) => f.name == normalizedFeature).toList();
      if (directMatch.isNotEmpty) {
        return directMatch.first.isEnabled;
      }
      
      // Check with underscores
      final underscoreMatch = featureFlags.where((f) => f.name == withUnderscores).toList();
      if (underscoreMatch.isNotEmpty) {
        return underscoreMatch.first.isEnabled;
      }
    }
    
    // Try direct lookup in feature flags array
    final directMatch = featureFlags.where((f) => f.name == featureName).toList();
    if (directMatch.isNotEmpty) {
      return directMatch.first.isEnabled;
    }
    
    // Try camelCase version
    final camelCase = featureName.replaceAllMapped(
      RegExp(r'_([a-z])'), 
      (m) => m.group(1)!.toUpperCase()
    );
    final camelMatch = featureFlags.where((f) => f.name == camelCase).toList();
    if (camelMatch.isNotEmpty) {
      return camelMatch.first.isEnabled;
    }
    
    // Try snake_case version
    final snakeCase = featureName.replaceAllMapped(
      RegExp(r'([A-Z])'), 
      (m) => '_${m.group(1)!.toLowerCase()}'
    );
    final snakeMatch = featureFlags.where((f) => f.name == snakeCase).toList();
    if (snakeMatch.isNotEmpty) {
      return snakeMatch.first.isEnabled;
    }
    
    // Feature not found - return false (hide features not in feature_flags)
    return false;
  }

  Map<String, dynamic>? getFeatureConfig(String featureName) {
    final feature = featureFlags.firstWhere(
      (flag) => flag.name == featureName,
      orElse: () => FeatureFlag(
        id: '',
        name: featureName,
        isEnabled: false,
        config: {},
      ),
    );
    return feature.config;
  }
  
  bool get isTenantActive => status == 'active';
}

class ContactInfo {
  final String? id;
  final String? name;
  final String email;
  final String phone;
  final String? supportUrl;
  final String? address;
  final SocialMedia? socialMedia;

  ContactInfo({
    this.id,
    this.name,
    required this.email,
    required this.phone,
    this.supportUrl,
    this.address,
    this.socialMedia,
  });

  factory ContactInfo.fromJson(Map<String, dynamic> json) {
    return ContactInfo(
      id: json['id'] as String?,
      name: json['name'] as String?,
      email: json['email'] as String,
      phone: json['phone'] as String,
      supportUrl: json['support_url'] as String? ?? json['supportUrl'] as String?,
      address: json['address'] as String?,
      socialMedia: json['social_media'] != null 
        ? SocialMedia.fromJson(json['social_media'] as Map<String, dynamic>)
        : json['socialMedia'] != null
          ? SocialMedia.fromJson(json['socialMedia'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'phone': phone,
      'support_url': supportUrl,
      'address': address,
      'social_media': socialMedia?.toJson(),
    };
  }
}

class SocialMedia {
  final String? facebook;
  final String? twitter;
  final String? instagram;
  final String? linkedin;

  SocialMedia({
    this.facebook,
    this.twitter,
    this.instagram,
    this.linkedin,
  });

  factory SocialMedia.fromJson(Map<String, dynamic> json) {
    return SocialMedia(
      facebook: json['facebook'] as String?,
      twitter: json['twitter'] as String?,
      instagram: json['instagram'] as String?,
      linkedin: json['linkedin'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'facebook': facebook,
      'twitter': twitter,
      'instagram': instagram,
      'linkedin': linkedin,
    };
  }
}

class BrandingInfo {
  final String? id;
  final String logoUrl;
  final String faviconUrl;
  final String primary_color;
  final String secondary_color;
  final String domain;
  final String? accentColor;
  final String backgroundColor;
  final String surfaceColor;
  final String? errorColor;
  final String? warningColor;
  final String? successColor;
  final String textPrimaryColor;
  final String textSecondaryColor;
  final double borderRadius;
  final String fontFamily;
  final String? customCss;

  BrandingInfo({
    this.id,
    required this.logoUrl,
    required this.faviconUrl,
    required this.primary_color,
    required this.secondary_color,
    required this.domain,
    this.accentColor,
    this.backgroundColor = '#F5F7FA',
    this.surfaceColor = '#FFFFFF',
    this.errorColor,
    this.warningColor,
    this.successColor,
    this.textPrimaryColor = '#212121',
    this.textSecondaryColor = '#757575',
    this.borderRadius = 12.0,
    this.fontFamily = 'Roboto',
    this.customCss,
  });

  factory BrandingInfo.fromJson(Map<String, dynamic> json) {
    return BrandingInfo(
      id: json['id'] as String?,
      logoUrl: json['logo_url'] as String? ?? json['logoUrl'] as String? ?? '',
      faviconUrl: json['favicon_url'] as String? ?? json['faviconUrl'] as String? ?? '',
      primary_color: json['primary_color'] as String? ?? json['primaryColor'] as String? ?? '#1A73E8',
      secondary_color: json['secondary_color'] as String? ?? json['secondaryColor'] as String? ?? '#00C853',
      domain: json['domain'] as String? ?? '',
      accentColor: json['accent_color'] as String? ?? json['accentColor'] as String?,
      backgroundColor: json['background_color'] as String? ?? json['backgroundColor'] as String? ?? '#F5F7FA',
      surfaceColor: json['surface_color'] as String? ?? json['surfaceColor'] as String? ?? '#FFFFFF',
      errorColor: json['error_color'] as String? ?? json['errorColor'] as String?,
      warningColor: json['warning_color'] as String? ?? json['warningColor'] as String?,
      successColor: json['success_color'] as String? ?? json['successColor'] as String?,
      textPrimaryColor: json['text_primary_color'] as String? ?? json['textPrimaryColor'] as String? ?? '#212121',
      textSecondaryColor: json['text_secondary_color'] as String? ?? json['textSecondaryColor'] as String? ?? '#757575',
      borderRadius: (json['border_radius'] as num?)?.toDouble() ?? (json['borderRadius'] as num?)?.toDouble() ?? 12.0,
      fontFamily: json['font_family'] as String? ?? json['fontFamily'] as String? ?? 'Roboto',
      customCss: json['custom_css'] as String? ?? json['customCss'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'logo_url': logoUrl,
      'favicon_url': faviconUrl,
      'primary_color': primary_color,
      'secondary_color': secondary_color,
      'domain': domain,
      'accent_color': accentColor,
      'background_color': backgroundColor,
      'surface_color': surfaceColor,
      'error_color': errorColor,
      'warning_color': warningColor,
      'success_color': successColor,
      'text_primary_color': textPrimaryColor,
      'text_secondary_color': textSecondaryColor,
      'border_radius': borderRadius,
      'font_family': fontFamily,
      'custom_css': customCss,
    };
  }
}

class FeatureFlag {
  final String id;
  final String name;
  final bool isEnabled;
  final Map<String, dynamic> config;

  FeatureFlag({
    required this.id,
    required this.name,
    required this.isEnabled,
    required this.config,
  });

  factory FeatureFlag.fromJson(Map<String, dynamic> json) {
    return FeatureFlag(
      id: json['id'] as String? ?? '',
      name: json['name'] as String,
      // isEnabled: json['is_enabled'] as bool? ?? json['isEnabled'] as bool? ?? false,
      isEnabled: true,
      config: json['config'] as Map<String, dynamic>? ?? {},
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'is_enabled': isEnabled,
      'config': config,
    };
  }
}

class TenantFeatures {
  final bool payments;
  final bool loans;
  final bool insurance;
  final bool auth;
  final bool userManagement;
  final bool accounts;
  final bool reporting;
  final bool savings;
  final bool notifications;
  final bool compliance;
  final bool kycKyb;
  final bool lpo;
  final bool dispute;
  final bool esusu;
  final bool escrow;
  final bool mortgage;
  final bool educationLoans;
  final bool agricultureFinance;
  final bool islamicBanking;
  final bool carbonCredits;
  final bool supplyChainFinance;
  final bool etherisc;
  final bool finance;
  final bool fx;
  final bool virtualAccounts;
  final bool chartOfAccounts;
  final bool teller;
  final bool treasury;
  final bool cardManagement;
  final bool fraudDetection;
  final bool reconciliation;
  final bool riskManagement;
  final bool relationshipManager;
  final bool communicationHub;
  final bool erpIntegration;
  final bool audit;
  final bool temporalAccess;
  final bool tradeFinance;
  final bool documentManagement;
  final bool employeeManagement;
  final bool merchantManagement;
  final bool developerPlatform;
  // Legacy enable-prefix flags
  final bool enableBiometrics;
  final bool enableQRPayments;
  final bool enablePushNotifications;
  final bool enableLPO;
  final bool enableCarbonCredits;
  final bool enableCards;
  final bool enableBillPayments;
  final bool enableRewards;
  final Map<String, dynamic> configs;

  TenantFeatures({
    this.payments = true,
    this.loans = false,
    this.insurance = false,
    this.auth = true,
    this.userManagement = false,
    this.accounts = true,
    this.reporting = false,
    this.savings = false,
    this.notifications = true,
    this.compliance = false,
    this.kycKyb = false,
    this.lpo = false,
    this.dispute = false,
    this.esusu = false,
    this.escrow = false,
    this.mortgage = false,
    this.educationLoans = false,
    this.agricultureFinance = false,
    this.islamicBanking = false,
    this.carbonCredits = false,
    this.supplyChainFinance = false,
    this.etherisc = false,
    this.finance = false,
    this.fx = false,
    this.virtualAccounts = false,
    this.chartOfAccounts = false,
    this.teller = false,
    this.treasury = false,
    this.cardManagement = false,
    this.fraudDetection = false,
    this.reconciliation = false,
    this.riskManagement = false,
    this.relationshipManager = false,
    this.communicationHub = false,
    this.erpIntegration = false,
    this.audit = false,
    this.temporalAccess = false,
    this.tradeFinance = false,
    this.documentManagement = false,
    this.employeeManagement = false,
    this.merchantManagement = false,
    this.developerPlatform = false,
    this.enableBiometrics = true,
    this.enableQRPayments = true,
    this.enablePushNotifications = true,
    this.enableLPO = false,
    this.enableCarbonCredits = false,
    this.enableCards = true,
    this.enableBillPayments = true,
    this.enableRewards = false,
    this.configs = const {},
  });

  factory TenantFeatures.fromFeatureFlags(List<FeatureFlag> flags) {
    final featuresMap = <String, bool>{};
    final configs = <String, dynamic>{};

    for (var flag in flags) {
      final camelCaseName = _toCamelCase(flag.name);
      featuresMap[flag.name] = flag.isEnabled;
      featuresMap[camelCaseName] = flag.isEnabled;
      if (flag.config.isNotEmpty) {
        configs['${camelCaseName}Config'] = flag.config;
      }
    }

    return TenantFeatures(
      payments: featuresMap['payments'] ?? true,
      loans: featuresMap['loans'] ?? false,
      insurance: featuresMap['insurance'] ?? false,
      auth: featuresMap['auth'] ?? true,
      userManagement: featuresMap['userManagement'] ?? false,
      accounts: featuresMap['accounts'] ?? true,
      reporting: featuresMap['reporting'] ?? false,
      savings: featuresMap['savings'] ?? false,
      notifications: featuresMap['notifications'] ?? true,
      compliance: featuresMap['compliance'] ?? false,
      kycKyb: featuresMap['kycKyb'] ?? false,
      lpo: featuresMap['lpo'] ?? false,
      dispute: featuresMap['dispute'] ?? false,
      esusu: featuresMap['esusu'] ?? false,
      escrow: featuresMap['escrow'] ?? false,
      mortgage: featuresMap['mortgage'] ?? false,
      educationLoans: featuresMap['educationLoans'] ?? false,
      agricultureFinance: featuresMap['agricultureFinance'] ?? false,
      islamicBanking: featuresMap['islamicBanking'] ?? false,
      carbonCredits: featuresMap['carbonCredits'] ?? false,
      supplyChainFinance: featuresMap['supplyChainFinance'] ?? false,
      etherisc: featuresMap['etherisc'] ?? false,
      finance: featuresMap['finance'] ?? false,
      fx: featuresMap['fx'] ?? false,
      virtualAccounts: featuresMap['virtualAccounts'] ?? false,
      chartOfAccounts: featuresMap['chartOfAccounts'] ?? false,
      teller: featuresMap['teller'] ?? false,
      treasury: featuresMap['treasury'] ?? false,
      cardManagement: featuresMap['cardManagement'] ?? false,
      fraudDetection: featuresMap['fraudDetection'] ?? false,
      reconciliation: featuresMap['reconciliation'] ?? false,
      riskManagement: featuresMap['riskManagement'] ?? false,
      relationshipManager: featuresMap['relationshipManager'] ?? false,
      communicationHub: featuresMap['communicationHub'] ?? false,
      erpIntegration: featuresMap['erpIntegration'] ?? false,
      audit: featuresMap['audit'] ?? false,
      temporalAccess: featuresMap['temporalAccess'] ?? false,
      tradeFinance: featuresMap['tradeFinance'] ?? false,
      documentManagement: featuresMap['documentManagement'] ?? false,
      employeeManagement: featuresMap['employeeManagement'] ?? false,
      merchantManagement: featuresMap['merchantManagement'] ?? false,
      developerPlatform: featuresMap['developerPlatform'] ?? false,
      enableBiometrics: featuresMap['enableBiometrics'] ?? true,
      enableQRPayments: featuresMap['enableQRPayments'] ?? true,
      enablePushNotifications: featuresMap['enablePushNotifications'] ?? true,
      enableLPO: featuresMap['lpo'] ?? false,
      enableCarbonCredits: featuresMap['carbonCredits'] ?? false,
      enableCards: featuresMap['enableCards'] ?? true,
      enableBillPayments: featuresMap['enableBillPayments'] ?? true,
      enableRewards: featuresMap['enableRewards'] ?? false,
      configs: configs,
    );
  }

  factory TenantFeatures.fromJson(Map<String, dynamic> json) {
    return TenantFeatures(
      payments: json['payments'] as bool? ?? true,
      loans: json['loans'] as bool? ?? false,
      insurance: json['insurance'] as bool? ?? false,
      auth: json['auth'] as bool? ?? true,
      userManagement: json['userManagement'] as bool? ?? json['user_management'] as bool? ?? false,
      accounts: json['accounts'] as bool? ?? true,
      reporting: json['reporting'] as bool? ?? false,
      savings: json['savings'] as bool? ?? false,
      notifications: json['notifications'] as bool? ?? true,
      compliance: json['compliance'] as bool? ?? false,
      kycKyb: json['kycKyb'] as bool? ?? json['kyc_kyb'] as bool? ?? false,
      lpo: json['lpo'] as bool? ?? false,
      dispute: json['dispute'] as bool? ?? false,
      esusu: json['esusu'] as bool? ?? false,
      escrow: json['escrow'] as bool? ?? false,
      mortgage: json['mortgage'] as bool? ?? false,
      educationLoans: json['educationLoans'] as bool? ?? json['education_loans'] as bool? ?? false,
      agricultureFinance: json['agricultureFinance'] as bool? ?? json['agriculture_finance'] as bool? ?? false,
      islamicBanking: json['islamicBanking'] as bool? ?? json['islamic_banking'] as bool? ?? false,
      carbonCredits: json['carbonCredits'] as bool? ?? json['carbon_credits'] as bool? ?? false,
      supplyChainFinance: json['supplyChainFinance'] as bool? ?? json['supply_chain_finance'] as bool? ?? false,
      etherisc: json['etherisc'] as bool? ?? false,
      finance: json['finance'] as bool? ?? false,
      fx: json['fx'] as bool? ?? false,
      virtualAccounts: json['virtualAccounts'] as bool? ?? json['virtual_accounts'] as bool? ?? false,
      chartOfAccounts: json['chartOfAccounts'] as bool? ?? json['chart_of_accounts'] as bool? ?? false,
      teller: json['teller'] as bool? ?? false,
      treasury: json['treasury'] as bool? ?? false,
      cardManagement: json['cardManagement'] as bool? ?? json['card_management'] as bool? ?? false,
      fraudDetection: json['fraudDetection'] as bool? ?? json['fraud_detection'] as bool? ?? false,
      reconciliation: json['reconciliation'] as bool? ?? false,
      riskManagement: json['riskManagement'] as bool? ?? json['risk_management'] as bool? ?? false,
      relationshipManager: json['relationshipManager'] as bool? ?? json['relationship_manager'] as bool? ?? false,
      communicationHub: json['communicationHub'] as bool? ?? json['communication_hub'] as bool? ?? false,
      erpIntegration: json['erpIntegration'] as bool? ?? json['erp_integration'] as bool? ?? false,
      audit: json['audit'] as bool? ?? false,
      temporalAccess: json['temporalAccess'] as bool? ?? json['temporal_access'] as bool? ?? false,
      tradeFinance: json['tradeFinance'] as bool? ?? json['trade_finance'] as bool? ?? false,
      documentManagement: json['documentManagement'] as bool? ?? json['document_management'] as bool? ?? false,
      employeeManagement: json['employeeManagement'] as bool? ?? json['employee_management'] as bool? ?? false,
      merchantManagement: json['merchantManagement'] as bool? ?? json['merchant_management'] as bool? ?? false,
      developerPlatform: json['developerPlatform'] as bool? ?? json['developer_platform'] as bool? ?? false,
      enableBiometrics: json['enableBiometrics'] as bool? ?? json['enable_biometrics'] as bool? ?? true,
      enableQRPayments: json['enableQRPayments'] as bool? ?? json['enable_qr_payments'] as bool? ?? true,
      enablePushNotifications: json['enablePushNotifications'] as bool? ?? json['enable_push_notifications'] as bool? ?? true,
      enableLPO: json['enableLPO'] as bool? ?? json['lpo'] as bool? ?? false,
      enableCarbonCredits: json['enableCarbonCredits'] as bool? ?? json['carbon_credits'] as bool? ?? false,
      enableCards: json['enableCards'] as bool? ?? json['enable_cards'] as bool? ?? true,
      enableBillPayments: json['enableBillPayments'] as bool? ?? json['enable_bill_payments'] as bool? ?? true,
      enableRewards: json['enableRewards'] as bool? ?? json['enable_rewards'] as bool? ?? false,
      configs: json['configs'] as Map<String, dynamic>? ?? {},
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'payments': payments,
      'loans': loans,
      'insurance': insurance,
      'auth': auth,
      'userManagement': userManagement,
      'accounts': accounts,
      'reporting': reporting,
      'savings': savings,
      'notifications': notifications,
      'compliance': compliance,
      'kycKyb': kycKyb,
      'lpo': lpo,
      'dispute': dispute,
      'esusu': esusu,
      'escrow': escrow,
      'mortgage': mortgage,
      'educationLoans': educationLoans,
      'agricultureFinance': agricultureFinance,
      'islamicBanking': islamicBanking,
      'carbonCredits': carbonCredits,
      'supplyChainFinance': supplyChainFinance,
      'etherisc': etherisc,
      'finance': finance,
      'fx': fx,
      'virtualAccounts': virtualAccounts,
      'chartOfAccounts': chartOfAccounts,
      'teller': teller,
      'treasury': treasury,
      'cardManagement': cardManagement,
      'fraudDetection': fraudDetection,
      'reconciliation': reconciliation,
      'riskManagement': riskManagement,
      'relationshipManager': relationshipManager,
      'communicationHub': communicationHub,
      'erpIntegration': erpIntegration,
      'audit': audit,
      'temporalAccess': temporalAccess,
      'tradeFinance': tradeFinance,
      'documentManagement': documentManagement,
      'employeeManagement': employeeManagement,
      'merchantManagement': merchantManagement,
      'developerPlatform': developerPlatform,
      'enableBiometrics': enableBiometrics,
      'enableQRPayments': enableQRPayments,
      'enablePushNotifications': enablePushNotifications,
      'enableLPO': enableLPO,
      'enableCarbonCredits': enableCarbonCredits,
      'enableCards': enableCards,
      'enableBillPayments': enableBillPayments,
      'enableRewards': enableRewards,
      'configs': configs,
    };
  }

  bool hasFeature(String name) {
    final map = toJson();
    return map.containsKey(name) || map.containsKey(_toCamelCase(name));
  }

  bool isEnabled(String name) {
    final map = toJson();
    return map[name] as bool? ?? map[_toCamelCase(name)] as bool? ?? false;
  }

  static String _toCamelCase(String input) {
    if (!input.contains('_')) return input;
    final parts = input.split('_');
    return parts[0] + parts.skip(1).map((p) => p[0].toUpperCase() + p.substring(1)).join();
  }
}

class TenantMetadata {
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;

  TenantMetadata({
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
  });

  factory TenantMetadata.fromJson(Map<String, dynamic> json) {
    return TenantMetadata(
      createdAt: DateTime.parse(json['created_at'] as String? ?? json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String? ?? json['updatedAt'] as String),
      deletedAt: json['deleted_at'] != null || json['deletedAt'] != null
          ? DateTime.parse((json['deleted_at'] ?? json['deletedAt']) as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'deleted_at': deletedAt?.toIso8601String(),
    };
  }
}
