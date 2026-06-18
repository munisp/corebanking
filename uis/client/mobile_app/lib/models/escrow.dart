class Escrow {
  final String id;
  final String title;
  final String type;
  final double amount;
  final String status;
  final String buyerName;
  final String buyerEmail;
  final String buyerAccountNumber;
  final String sellerName;
  final String sellerEmail;
  final String sellerAccountNumber;
  final String sellerBank;
  final String? agentName;
  final String? agentEmail;
  final String releaseConditions;
  final DateTime createdAt;
  final DateTime? releaseDate;
  final String? description;
  final String currency;
  final String useCase;

  Escrow({
    required this.id,
    required this.title,
    required this.type,
    required this.amount,
    required this.status,
    required this.buyerName,
    required this.buyerEmail,
    this.buyerAccountNumber = '',
    required this.sellerName,
    required this.sellerEmail,
    required this.sellerAccountNumber,
    required this.sellerBank,
    this.agentName,
    this.agentEmail,
    required this.releaseConditions,
    required this.createdAt,
    this.releaseDate,
    this.description,
    this.currency = 'NGN',
    this.useCase = '',
  });

  factory Escrow.fromJson(Map<String, dynamic> json) {
    // Backend sends parties as an array: [{role: "buyer", name: ..., email: ..., account_number: ..., bank_code: ...}, ...]
    Map<String, dynamic> _partyByRole(List<dynamic> parties, String role) {
      try {
        return parties.firstWhere(
          (p) => (p as Map<String, dynamic>)['role']?.toString().toLowerCase() == role,
          orElse: () => <String, dynamic>{},
        ) as Map<String, dynamic>;
      } catch (_) {
        return <String, dynamic>{};
      }
    }

    final partiesRaw = json['parties'];
    final parties = (partiesRaw is List) ? partiesRaw : <dynamic>[];

    final buyer = _partyByRole(parties, 'buyer');
    final seller = _partyByRole(parties, 'seller');
    final agent = _partyByRole(parties, 'agent');

    return Escrow(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      type: (json['use_case'] ?? json['type'] ?? '').toString(),
      amount: (json['total_amount'] ?? json['amount'] ?? 0).toDouble(),
      status: (json['status'] ?? '').toString(),
      buyerName: (buyer['name'] ?? '').toString(),
      buyerEmail: (buyer['email'] ?? '').toString(),
      buyerAccountNumber: (buyer['account_number'] ?? '').toString(),
      sellerName: (seller['name'] ?? '').toString(),
      sellerEmail: (seller['email'] ?? '').toString(),
      sellerAccountNumber: (seller['account_number'] ?? '').toString(),
      sellerBank: (seller['bank_code'] ?? '').toString(),
      agentName: agent['name']?.toString(),
      agentEmail: agent['email']?.toString(),
      releaseConditions: (json['release_conditions'] ?? json['releaseConditions'] ?? '').toString(),
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      releaseDate: json['completed_at'] != null
          ? DateTime.tryParse(json['completed_at'].toString())
          : null,
      description: json['description']?.toString(),
      currency: (json['currency'] ?? 'NGN').toString(),
      useCase: (json['use_case'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'use_case': type,
      'total_amount': amount,
      'status': status,
      'parties': [
        {'role': 'buyer', 'name': buyerName, 'email': buyerEmail, 'account_number': buyerAccountNumber},
        {'role': 'seller', 'name': sellerName, 'email': sellerEmail, 'account_number': sellerAccountNumber, 'bank_code': sellerBank},
        if (agentName != null) {'role': 'agent', 'name': agentName, 'email': agentEmail},
      ],
      'release_conditions': releaseConditions,
      'created_at': createdAt.toIso8601String(),
      'completed_at': releaseDate?.toIso8601String(),
      'description': description,
      'currency': currency,
    };
  }
}
