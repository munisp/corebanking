class RemittanceTransfer {
  final String id;
  final String transferRef;
  final String senderId;
  final String senderName;
  final String beneficiaryName;
  final String beneficiaryAccount;
  final String beneficiaryBank;
  final double amount;
  final String senderCurrency;
  final String beneficiaryCurrency;
  final String corridor;
  final double? exchangeRate;
  final double? fee;
  final String channel;
  final String status;
  final String createdAt;
  final String? completedAt;

  RemittanceTransfer({
    required this.id,
    required this.transferRef,
    required this.senderId,
    required this.senderName,
    required this.beneficiaryName,
    required this.beneficiaryAccount,
    required this.beneficiaryBank,
    required this.amount,
    this.senderCurrency = 'USD',
    this.beneficiaryCurrency = 'NGN',
    required this.corridor,
    this.exchangeRate,
    this.fee,
    this.channel = 'online',
    required this.status,
    required this.createdAt,
    this.completedAt,
  });

  factory RemittanceTransfer.fromJson(Map<String, dynamic> json) {
    return RemittanceTransfer(
      id: (json['id'] ?? '').toString(),
      transferRef: (json['transfer_ref'] ?? json['transferRef'] ?? '').toString(),
      senderId: (json['sender_id'] ?? json['senderId'] ?? '').toString(),
      senderName: (json['sender_name'] ?? json['senderName'] ?? '').toString(),
      beneficiaryName: (json['beneficiary_name'] ?? json['beneficiaryName'] ?? '').toString(),
      beneficiaryAccount: (json['beneficiary_account'] ?? json['beneficiaryAccount'] ?? '').toString(),
      beneficiaryBank: (json['beneficiary_bank'] ?? json['beneficiaryBank'] ?? '').toString(),
      amount: (json['amount'] ?? 0).toDouble(),
      senderCurrency: (json['sender_currency'] ?? json['senderCurrency'] ?? 'USD').toString(),
      beneficiaryCurrency: (json['beneficiary_currency'] ?? json['beneficiaryCurrency'] ?? 'NGN').toString(),
      corridor: (json['corridor'] ?? '').toString(),
      exchangeRate: json['exchange_rate'] != null ? (json['exchange_rate']).toDouble() : null,
      fee: json['fee'] != null ? (json['fee']).toDouble() : null,
      channel: (json['channel'] ?? 'online').toString(),
      status: (json['status'] ?? 'pending').toString(),
      createdAt: (json['created_at'] ?? json['createdAt'] ?? '').toString(),
      completedAt: json['completed_at']?.toString() ?? json['completedAt']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'transfer_ref': transferRef,
        'sender_id': senderId,
        'sender_name': senderName,
        'beneficiary_name': beneficiaryName,
        'beneficiary_account': beneficiaryAccount,
        'beneficiary_bank': beneficiaryBank,
        'amount': amount,
        'sender_currency': senderCurrency,
        'beneficiary_currency': beneficiaryCurrency,
        'corridor': corridor,
        if (exchangeRate != null) 'exchange_rate': exchangeRate,
        if (fee != null) 'fee': fee,
        'channel': channel,
        'status': status,
        'created_at': createdAt,
        if (completedAt != null) 'completed_at': completedAt,
      };
}
