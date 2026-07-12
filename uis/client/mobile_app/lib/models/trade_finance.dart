class LetterOfCredit {
  final String id;
  final String lcRef;
  final String type; // irrevocable, revocable, standby, confirmed
  final String applicantId;
  final String beneficiaryName;
  final String beneficiaryCountry;
  final double amount;
  final String currency;
  final String availableBy;
  final String expiryDate;
  final String placeOfExpiry;
  final String goodsDescription;
  final String swiftRef;
  final String status; // draft, issued, confirmed, amended, expired, cancelled
  final String? issuedAt;
  final String createdAt;

  LetterOfCredit({
    this.id = '',
    this.lcRef = '',
    this.type = 'irrevocable',
    this.applicantId = '',
    this.beneficiaryName = '',
    this.beneficiaryCountry = '',
    this.amount = 0.0,
    this.currency = 'USD',
    this.availableBy = '',
    this.expiryDate = '',
    this.placeOfExpiry = '',
    this.goodsDescription = '',
    this.swiftRef = '',
    this.status = 'draft',
    this.issuedAt,
    this.createdAt = '',
  });

  factory LetterOfCredit.fromJson(Map<String, dynamic> json) {
    return LetterOfCredit(
      id: json['id']?.toString() ?? '',
      lcRef: json['lc_ref']?.toString() ?? json['lcRef']?.toString() ?? '',
      type: json['type']?.toString() ?? 'irrevocable',
      applicantId: json['applicant_id']?.toString() ?? json['applicantId']?.toString() ?? '',
      beneficiaryName: json['beneficiary_name']?.toString() ?? json['beneficiaryName']?.toString() ?? '',
      beneficiaryCountry: json['beneficiary_country']?.toString() ?? json['beneficiaryCountry']?.toString() ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency']?.toString() ?? 'USD',
      availableBy: json['available_by']?.toString() ?? json['availableBy']?.toString() ?? '',
      expiryDate: json['expiry_date']?.toString() ?? json['expiryDate']?.toString() ?? '',
      placeOfExpiry: json['place_of_expiry']?.toString() ?? json['placeOfExpiry']?.toString() ?? '',
      goodsDescription: json['goods_description']?.toString() ?? json['goodsDescription']?.toString() ?? '',
      swiftRef: json['swift_ref']?.toString() ?? json['swiftRef']?.toString() ?? '',
      status: json['status']?.toString() ?? 'draft',
      issuedAt: json['issued_at']?.toString() ?? json['issuedAt']?.toString(),
      createdAt: json['created_at']?.toString() ?? json['createdAt']?.toString() ?? '',
    );
  }
}

class BankGuarantee {
  final String id;
  final String guaranteeRef;
  final String type; // performance, payment, bid_bond, advance_payment
  final String applicantId;
  final String beneficiaryName;
  final double amount;
  final String currency;
  final String expiryDate;
  final String purpose;
  final String status; // draft, issued, extended, cancelled, expired
  final String createdAt;

  BankGuarantee({
    this.id = '',
    this.guaranteeRef = '',
    this.type = 'performance',
    this.applicantId = '',
    this.beneficiaryName = '',
    this.amount = 0.0,
    this.currency = 'NGN',
    this.expiryDate = '',
    this.purpose = '',
    this.status = 'draft',
    this.createdAt = '',
  });

  factory BankGuarantee.fromJson(Map<String, dynamic> json) {
    return BankGuarantee(
      id: json['id']?.toString() ?? '',
      guaranteeRef: json['guarantee_ref']?.toString() ?? json['guaranteeRef']?.toString() ?? '',
      type: json['type']?.toString() ?? 'performance',
      applicantId: json['applicant_id']?.toString() ?? json['applicantId']?.toString() ?? '',
      beneficiaryName: json['beneficiary_name']?.toString() ?? json['beneficiaryName']?.toString() ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency']?.toString() ?? 'NGN',
      expiryDate: json['expiry_date']?.toString() ?? json['expiryDate']?.toString() ?? '',
      purpose: json['purpose']?.toString() ?? '',
      status: json['status']?.toString() ?? 'draft',
      createdAt: json['created_at']?.toString() ?? json['createdAt']?.toString() ?? '',
    );
  }
}

class FactoringApplication {
  final String id;
  final String applicationRef;
  final String applicantId;
  final String debtorName;
  final double invoiceTotal;
  final double factoringAmount;
  final String currency;
  final double discountRate;
  final String status; // pending, approved, rejected, disbursed
  final int invoiceCount;
  final String createdAt;

  FactoringApplication({
    this.id = '',
    this.applicationRef = '',
    this.applicantId = '',
    this.debtorName = '',
    this.invoiceTotal = 0.0,
    this.factoringAmount = 0.0,
    this.currency = 'NGN',
    this.discountRate = 0.0,
    this.status = 'pending',
    this.invoiceCount = 0,
    this.createdAt = '',
  });

  factory FactoringApplication.fromJson(Map<String, dynamic> json) {
    return FactoringApplication(
      id: json['id']?.toString() ?? '',
      applicationRef: json['application_ref']?.toString() ?? json['applicationRef']?.toString() ?? '',
      applicantId: json['applicant_id']?.toString() ?? json['applicantId']?.toString() ?? '',
      debtorName: json['debtor_name']?.toString() ?? json['debtorName']?.toString() ?? '',
      invoiceTotal: (json['invoice_total'] as num?)?.toDouble() ?? 0.0,
      factoringAmount: (json['factoring_amount'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency']?.toString() ?? 'NGN',
      discountRate: (json['discount_rate'] as num?)?.toDouble() ?? 0.0,
      status: json['status']?.toString() ?? 'pending',
      invoiceCount: (json['invoice_count'] as num?)?.toInt() ?? 0,
      createdAt: json['created_at']?.toString() ?? json['createdAt']?.toString() ?? '',
    );
  }
}
