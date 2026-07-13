/// pup Virtual Account Number (VAN) Service
/// Production API integration for VAN management
/// NOTE: ApiClient implementation is required for this service to work
library;

import 'dart:async';
// import 'api_client.dart';

/// VAN purpose types
enum VANPurpose {
  loanCollection,
  merchant,
  escrow,
  agent,
  payroll,
}

extension VANPurposeExtension on VANPurpose {
  String get value {
    switch (this) {
      case VANPurpose.loanCollection:
        return 'loan_collection';
      case VANPurpose.merchant:
        return 'merchant';
      case VANPurpose.escrow:
        return 'escrow';
      case VANPurpose.agent:
        return 'agent';
      case VANPurpose.payroll:
        return 'payroll';
    }
  }

  static VANPurpose fromString(String value) {
    switch (value) {
      case 'loan_collection':
        return VANPurpose.loanCollection;
      case 'merchant':
        return VANPurpose.merchant;
      case 'escrow':
        return VANPurpose.escrow;
      case 'agent':
        return VANPurpose.agent;
      case 'payroll':
        return VANPurpose.payroll;
      default:
        return VANPurpose.merchant;
    }
  }
}

/// VAN status types
enum VANStatus {
  active,
  suspended,
  inactive,
  expired,
}

extension VANStatusExtension on VANStatus {
  String get value {
    switch (this) {
      case VANStatus.active:
        return 'active';
      case VANStatus.suspended:
        return 'suspended';
      case VANStatus.inactive:
        return 'inactive';
      case VANStatus.expired:
        return 'expired';
    }
  }

  static VANStatus fromString(String value) {
    switch (value) {
      case 'active':
        return VANStatus.active;
      case 'suspended':
        return VANStatus.suspended;
      case 'inactive':
        return VANStatus.inactive;
      case 'expired':
        return VANStatus.expired;
      default:
        return VANStatus.inactive;
    }
  }
}

/// Payment status types
enum PaymentStatus {
  pending,
  completed,
  failed,
  reversed,
}

extension PaymentStatusExtension on PaymentStatus {
  String get value {
    switch (this) {
      case PaymentStatus.pending:
        return 'pending';
      case PaymentStatus.completed:
        return 'completed';
      case PaymentStatus.failed:
        return 'failed';
      case PaymentStatus.reversed:
        return 'reversed';
    }
  }

  static PaymentStatus fromString(String value) {
    switch (value) {
      case 'pending':
        return PaymentStatus.pending;
      case 'completed':
        return PaymentStatus.completed;
      case 'failed':
        return PaymentStatus.failed;
      case 'reversed':
        return PaymentStatus.reversed;
      default:
        return PaymentStatus.pending;
    }
  }
}

/// Virtual Account model
class VirtualAccount {
  final String id;
  final String accountNumber;
  final VANPurpose purpose;
  final String label;
  final double balance;
  final double totalReceived;
  final VANStatus status;
  final DateTime createdAt;
  final DateTime? expiresAt;
  final bool isSingleUse;
  final double? minAmount;
  final double? maxAmount;
  final String? webhookUrl;
  final String? linkedAccountId;
  final Map<String, dynamic>? metadata;

  VirtualAccount({
    required this.id,
    required this.accountNumber,
    required this.purpose,
    required this.label,
    required this.balance,
    required this.totalReceived,
    required this.status,
    required this.createdAt,
    this.expiresAt,
    this.isSingleUse = false,
    this.minAmount,
    this.maxAmount,
    this.webhookUrl,
    this.linkedAccountId,
    this.metadata,
  });

  factory VirtualAccount.fromJson(Map<String, dynamic> json) {
    return VirtualAccount(
      id: json['id'] ?? json['van_id'] ?? '',
      accountNumber: json['account_number'] ?? json['van_number'] ?? '',
      purpose: VANPurposeExtension.fromString(json['purpose'] ?? 'merchant'),
      label: json['label'] ?? json['name'] ?? '',
      balance: (json['balance'] ?? 0).toDouble(),
      totalReceived: (json['total_received'] ?? json['total_credits'] ?? 0).toDouble(),
      status: VANStatusExtension.fromString(json['status'] ?? 'active'),
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
      expiresAt: json['expires_at'] != null
          ? DateTime.parse(json['expires_at'])
          : null,
      isSingleUse: json['is_single_use'] ?? json['single_use'] ?? false,
      minAmount: json['min_amount']?.toDouble(),
      maxAmount: json['max_amount']?.toDouble(),
      webhookUrl: json['webhook_url'],
      linkedAccountId: json['linked_account_id'],
      metadata: json['metadata'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'account_number': accountNumber,
      'purpose': purpose.value,
      'label': label,
      'balance': balance,
      'total_received': totalReceived,
      'status': status.value,
      'created_at': createdAt.toIso8601String(),
      if (expiresAt != null) 'expires_at': expiresAt!.toIso8601String(),
      'is_single_use': isSingleUse,
      if (minAmount != null) 'min_amount': minAmount,
      if (maxAmount != null) 'max_amount': maxAmount,
      if (webhookUrl != null) 'webhook_url': webhookUrl,
      if (linkedAccountId != null) 'linked_account_id': linkedAccountId,
      if (metadata != null) 'metadata': metadata,
    };
  }

  VirtualAccount copyWith({
    String? id,
    String? accountNumber,
    VANPurpose? purpose,
    String? label,
    double? balance,
    double? totalReceived,
    VANStatus? status,
    DateTime? createdAt,
    DateTime? expiresAt,
    bool? isSingleUse,
    double? minAmount,
    double? maxAmount,
    String? webhookUrl,
    String? linkedAccountId,
    Map<String, dynamic>? metadata,
  }) {
    return VirtualAccount(
      id: id ?? this.id,
      accountNumber: accountNumber ?? this.accountNumber,
      purpose: purpose ?? this.purpose,
      label: label ?? this.label,
      balance: balance ?? this.balance,
      totalReceived: totalReceived ?? this.totalReceived,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      expiresAt: expiresAt ?? this.expiresAt,
      isSingleUse: isSingleUse ?? this.isSingleUse,
      minAmount: minAmount ?? this.minAmount,
      maxAmount: maxAmount ?? this.maxAmount,
      webhookUrl: webhookUrl ?? this.webhookUrl,
      linkedAccountId: linkedAccountId ?? this.linkedAccountId,
      metadata: metadata ?? this.metadata,
    );
  }
}

/// VAN Payment model
class VANPayment {
  final String id;
  final String vanId;
  final double amount;
  final String senderName;
  final String senderBank;
  final String senderAccount;
  final String reference;
  final String narration;
  final PaymentStatus status;
  final DateTime receivedAt;
  final String? sessionId;
  final Map<String, dynamic>? metadata;

  VANPayment({
    required this.id,
    required this.vanId,
    required this.amount,
    required this.senderName,
    required this.senderBank,
    required this.senderAccount,
    required this.reference,
    required this.narration,
    required this.status,
    required this.receivedAt,
    this.sessionId,
    this.metadata,
  });

  factory VANPayment.fromJson(Map<String, dynamic> json) {
    return VANPayment(
      id: json['id'] ?? json['payment_id'] ?? '',
      vanId: json['van_id'] ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      senderName: json['sender_name'] ?? json['originator_name'] ?? '',
      senderBank: json['sender_bank'] ?? json['originator_bank'] ?? '',
      senderAccount: json['sender_account'] ?? json['originator_account'] ?? '',
      reference: json['reference'] ?? json['payment_reference'] ?? '',
      narration: json['narration'] ?? json['description'] ?? '',
      status: PaymentStatusExtension.fromString(json['status'] ?? 'completed'),
      receivedAt: json['received_at'] != null
          ? DateTime.parse(json['received_at'])
          : json['created_at'] != null
              ? DateTime.parse(json['created_at'])
              : DateTime.now(),
      sessionId: json['session_id'],
      metadata: json['metadata'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'van_id': vanId,
      'amount': amount,
      'sender_name': senderName,
      'sender_bank': senderBank,
      'sender_account': senderAccount,
      'reference': reference,
      'narration': narration,
      'status': status.value,
      'received_at': receivedAt.toIso8601String(),
      if (sessionId != null) 'session_id': sessionId,
      if (metadata != null) 'metadata': metadata,
    };
  }
}

/// Create VAN request
class CreateVANRequest {
  final String label;
  final VANPurpose purpose;
  final bool isSingleUse;
  final DateTime? expiresAt;
  final double? minAmount;
  final double? maxAmount;
  final String? webhookUrl;
  final String? linkedAccountId;
  final Map<String, dynamic>? metadata;

  CreateVANRequest({
    required this.label,
    required this.purpose,
    this.isSingleUse = false,
    this.expiresAt,
    this.minAmount,
    this.maxAmount,
    this.webhookUrl,
    this.linkedAccountId,
    this.metadata,
  });

  Map<String, dynamic> toJson() {
    return {
      'label': label,
      'purpose': purpose.value,
      'is_single_use': isSingleUse,
      if (expiresAt != null) 'expires_at': expiresAt!.toIso8601String(),
      if (minAmount != null) 'min_amount': minAmount,
      if (maxAmount != null) 'max_amount': maxAmount,
      if (webhookUrl != null) 'webhook_url': webhookUrl,
      if (linkedAccountId != null) 'parent_account_id': linkedAccountId,
      if (metadata != null) 'metadata': metadata,
    };
  }
}

/// VAN Analytics model
class VANAnalytics {
  final double totalReceived;
  final double totalBalance;
  final int activeVANs;
  final int totalPayments;
  final Map<VANPurpose, int> vansByPurpose;
  final List<MonthlyCollection> monthlyCollections;

  VANAnalytics({
    required this.totalReceived,
    required this.totalBalance,
    required this.activeVANs,
    required this.totalPayments,
    required this.vansByPurpose,
    required this.monthlyCollections,
  });

  factory VANAnalytics.fromJson(Map<String, dynamic> json) {
    final purposeMap = <VANPurpose, int>{};
    if (json['vans_by_purpose'] != null) {
      (json['vans_by_purpose'] as Map<String, dynamic>).forEach((key, value) {
        purposeMap[VANPurposeExtension.fromString(key)] = value as int;
      });
    }

    return VANAnalytics(
      totalReceived: (json['total_received'] ?? 0).toDouble(),
      totalBalance: (json['total_balance'] ?? 0).toDouble(),
      activeVANs: json['active_vans'] ?? 0,
      totalPayments: json['total_payments'] ?? 0,
      vansByPurpose: purposeMap,
      monthlyCollections: (json['monthly_collections'] as List?)
              ?.map((item) => MonthlyCollection.fromJson(item))
              .toList() ??
          [],
    );
  }
}

/// Monthly collection data
class MonthlyCollection {
  final String month;
  final double amount;
  final int count;

  MonthlyCollection({
    required this.month,
    required this.amount,
    required this.count,
  });

  factory MonthlyCollection.fromJson(Map<String, dynamic> json) {
    return MonthlyCollection(
      month: json['month'] ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      count: json['count'] ?? 0,
    );
  }
}

/// VAN Service for API integration
class VANService {
  static VANService? _instance;
  static VANService get instance => _instance ??= VANService._();

  // final ApiClient _apiClient;

  VANService._(); // : _apiClient = ApiClient.instance;

  /// Get all virtual accounts
  Future<List<VirtualAccount>> getVirtualAccounts({
    VANStatus? status,
    VANPurpose? purpose,
    int page = 1,
    int pageSize = 20,
  }) async {
    // Mock data - replace with actual API call
    await Future.delayed(const Duration(milliseconds: 500));
    return [
      VirtualAccount(
        id: '1',
        accountNumber: '9876543210',
        purpose: VANPurpose.loanCollection,
        label: 'Online Sales Collection',
        balance: 0,
        totalReceived: 1250000,
        status: VANStatus.active,
        createdAt: DateTime.now().subtract(const Duration(days: 60)),
        expiresAt: null,
        isSingleUse: false,
        minAmount: null,
        maxAmount: null,
        webhookUrl: 'https://example.com/webhook',
        linkedAccountId: null,
        metadata: {'purpose': 'e-commerce'},
      ),
      VirtualAccount(
        id: '2',
        accountNumber: '9876543211',
        purpose: VANPurpose.escrow,
        label: 'Property Sale Escrow',
        balance: 5000000,
        totalReceived: 5000000,
        status: VANStatus.active,
        createdAt: DateTime.now().subtract(const Duration(days: 30)),
        expiresAt: DateTime.now().add(const Duration(days: 60)),
        isSingleUse: true,
        minAmount: 5000000,
        maxAmount: 5000000,
        webhookUrl: null,
        linkedAccountId: 'ACC001',
        metadata: {'transaction_id': 'ESC-2025-001'},
      ),
      VirtualAccount(
        id: '3',
        accountNumber: '9876543212',
        purpose: VANPurpose.escrow,
        label: 'Charity Donations',
        balance: 0,
        totalReceived: 350000,
        status: VANStatus.active,
        createdAt: DateTime.now().subtract(const Duration(days: 90)),
        expiresAt: null,
        isSingleUse: false,
        minAmount: 1000,
        maxAmount: null,
        webhookUrl: null,
        linkedAccountId: null,
        metadata: null,
      ),
    ];
  }

  /// Get a single virtual account by ID
  Future<VirtualAccount> getVirtualAccount(String vanId) async {
    // Mock data - replace with actual API call
    await Future.delayed(const Duration(milliseconds: 500));
    return VirtualAccount(
      id: vanId,
      accountNumber: '9876543210',
      purpose: VANPurpose.loanCollection,
      label: 'Online Sales Collection',
      balance: 0,
      totalReceived: 1250000,
      status: VANStatus.active,
      createdAt: DateTime.now().subtract(const Duration(days: 60)),
      expiresAt: null,
      isSingleUse: false,
      minAmount: null,
      maxAmount: null,
      webhookUrl: 'https://example.com/webhook',
      linkedAccountId: null,
      metadata: {'purpose': 'e-commerce'},
    );
  }

  /// Create a new virtual account
  Future<VirtualAccount> createVirtualAccount(CreateVANRequest request) async {
    // Mock data - replace with actual API call
    await Future.delayed(const Duration(milliseconds: 800));
    return VirtualAccount(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      accountNumber: '98765${DateTime.now().millisecondsSinceEpoch % 100000}'.padLeft(10, '0'),
      purpose: request.purpose,
      label: request.label,
      balance: 0,
      totalReceived: 0,
      status: VANStatus.active,
      createdAt: DateTime.now(),
      expiresAt: request.expiresAt,
      isSingleUse: request.isSingleUse,
      minAmount: request.minAmount,
      maxAmount: request.maxAmount,
      webhookUrl: request.webhookUrl,
      linkedAccountId: request.linkedAccountId,
      metadata: request.metadata,
    );
  }

  /// Update a virtual account
  Future<VirtualAccount> updateVirtualAccount(
    String vanId, {
    String? label,
    String? webhookUrl,
    double? minAmount,
    double? maxAmount,
    Map<String, dynamic>? metadata,
  }) async {
    // Mock data - replace with actual API call
    await Future.delayed(const Duration(milliseconds: 500));
    return VirtualAccount(
      id: vanId,
      accountNumber: '9876543210',
      purpose: VANPurpose.loanCollection,
      label: label ?? 'Online Sales Collection',
      balance: 0,
      totalReceived: 1250000,
      status: VANStatus.active,
      createdAt: DateTime.now().subtract(const Duration(days: 60)),
      expiresAt: null,
      isSingleUse: false,
      minAmount: minAmount,
      maxAmount: maxAmount,
      webhookUrl: webhookUrl ?? 'https://example.com/webhook',
      linkedAccountId: null,
      metadata: metadata ?? {'purpose': 'e-commerce'},
    );
  }

  /// Suspend a virtual account
  Future<VirtualAccount> suspendVirtualAccount(String vanId) async {
    // Mock data - replace with actual API call
    await Future.delayed(const Duration(milliseconds: 500));
    return VirtualAccount(
      id: vanId,
      accountNumber: '9876543210',
      purpose: VANPurpose.loanCollection,
      label: 'Online Sales Collection',
      balance: 0,
      totalReceived: 1250000,
      status: VANStatus.suspended,
      createdAt: DateTime.now().subtract(const Duration(days: 60)),
      expiresAt: null,
      isSingleUse: false,
      minAmount: null,
      maxAmount: null,
      webhookUrl: 'https://example.com/webhook',
      linkedAccountId: null,
      metadata: {'purpose': 'e-commerce'},
    );
  }

  /// Reactivate a virtual account
  Future<VirtualAccount> reactivateVirtualAccount(String vanId) async {
    // Mock data - replace with actual API call
    await Future.delayed(const Duration(milliseconds: 500));
    return VirtualAccount(
      id: vanId,
      accountNumber: '9876543210',
      purpose: VANPurpose.loanCollection,
      label: 'Online Sales Collection',
      balance: 0,
      totalReceived: 1250000,
      status: VANStatus.active,
      createdAt: DateTime.now().subtract(const Duration(days: 60)),
      expiresAt: null,
      isSingleUse: false,
      minAmount: null,
      maxAmount: null,
      webhookUrl: 'https://example.com/webhook',
      linkedAccountId: null,
      metadata: {'purpose': 'e-commerce'},
    );
  }

  /// Close a virtual account
  Future<void> closeVirtualAccount(String vanId) async {
    // Mock data - replace with actual API call
    await Future.delayed(const Duration(milliseconds: 500));
  }

  /// Get payments for a virtual account
  Future<List<VANPayment>> getPayments({
    String? vanId,
    PaymentStatus? status,
    DateTime? fromDate,
    DateTime? toDate,
    int page = 1,
    int pageSize = 20,
  }) async {
    // Mock data - replace with actual API call
    await Future.delayed(const Duration(milliseconds: 500));
    return [
      VANPayment(
        id: '1',
        vanId: vanId ?? '1',
        amount: 50000,
        senderName: 'Adebayo Ogunleye',
        senderBank: 'GTBank',
        senderAccount: '0123456789',
        reference: 'PAY001',
        narration: 'Payment for online order',
        status: PaymentStatus.completed,
        receivedAt: DateTime.now().subtract(const Duration(hours: 5)),
        sessionId: 'SES001',
        metadata: null,
      ),
      VANPayment(
        id: '2',
        vanId: vanId ?? '1',
        amount: 75000,
        senderName: 'Ngozi Okoro',
        senderBank: 'Zenith Bank',
        senderAccount: '9876543210',
        reference: 'PAY002',
        narration: 'Service payment',
        status: PaymentStatus.completed,
        receivedAt: DateTime.now().subtract(const Duration(days: 1)),
        sessionId: 'SES002',
        metadata: null,
      ),
      VANPayment(
        id: '3',
        vanId: vanId ?? '1',
        amount: 120000,
        senderName: 'Chidi Eze',
        senderBank: 'Access Bank',
        senderAccount: '5555666677',
        reference: 'PAY003',
        narration: 'Product purchase',
        status: PaymentStatus.completed,
        receivedAt: DateTime.now().subtract(const Duration(days: 3)),
        sessionId: 'SES003',
        metadata: null,
      ),
    ];
  }

  /// Get a single payment by ID
  Future<VANPayment> getPayment(String paymentId) async {
    // Mock data - replace with actual API call
    await Future.delayed(const Duration(milliseconds: 500));
    return VANPayment(
      id: paymentId,
      vanId: '1',
      amount: 50000,
      senderName: 'Adebayo Ogunleye',
      senderBank: 'GTBank',
      senderAccount: '0123456789',
      reference: 'PAY001',
      narration: 'Payment for online order',
      status: PaymentStatus.completed,
      receivedAt: DateTime.now().subtract(const Duration(hours: 5)),
      sessionId: 'SES001',
      metadata: null,
    );
  }

  /// Get VAN analytics
  Future<VANAnalytics> getAnalytics({
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    // Mock data - replace with actual API call
    await Future.delayed(const Duration(milliseconds: 500));
    return VANAnalytics(
      totalReceived: 3250000,
      totalBalance: 2100000,
      activeVANs: 8,
      totalPayments: 45,
      vansByPurpose: {
        VANPurpose.loanCollection: 5,
        VANPurpose.merchant: 3,
        VANPurpose.escrow: 2,
        VANPurpose.agent: 1,
        VANPurpose.payroll: 1,
      },
      monthlyCollections: [
        MonthlyCollection(month: 'Oct', amount: 850000, count: 12),
        MonthlyCollection(month: 'Nov', amount: 1200000, count: 18),
        MonthlyCollection(month: 'Dec', amount: 1200000, count: 15),
      ],
    );
  }

  /// Verify a VAN payment webhook signature
  Future<bool> verifyWebhookSignature({
    required String payload,
    required String signature,
    required String webhookSecret,
  }) async {
    // Mock data - replace with actual API call
    await Future.delayed(const Duration(milliseconds: 300));
    return true; // Mock verification always returns true
  }
}
