class Mortgage {
  final String id;
  final String applicationNumber;
  final String propertyAddress;
  final String propertyCity;
  final String propertyState;
  final String propertyLga;
  final String propertyType;
  final double propertyValue;
  final double loanAmount;
  final double downPayment;
  final int loanTermMonths;
  final double interestRate;
  final double monthlyPayment;
  final String status;
  final String productType;
  final String interestType;
  final String applicantName;
  final String applicantEmail;
  final String applicantPhone;
  final String employmentStatus;
  final double monthlyIncome;
  final String titleType;
  final String titleNumber;
  final double underwritingScore;
  final DateTime applicationDate;
  final DateTime? approvalDate;
  final String? description;

  Mortgage({
    required this.id,
    this.applicationNumber = '',
    required this.propertyAddress,
    this.propertyCity = '',
    this.propertyState = '',
    this.propertyLga = '',
    required this.propertyType,
    required this.propertyValue,
    required this.loanAmount,
    required this.downPayment,
    required this.loanTermMonths,
    required this.interestRate,
    required this.monthlyPayment,
    required this.status,
    this.productType = '',
    this.interestType = '',
    this.applicantName = '',
    this.applicantEmail = '',
    this.applicantPhone = '',
    this.employmentStatus = '',
    this.monthlyIncome = 0.0,
    this.titleType = '',
    this.titleNumber = '',
    this.underwritingScore = 0.0,
    required this.applicationDate,
    this.approvalDate,
    this.description,
  });

  int get loanTerm => (loanTermMonths / 12).round();

  factory Mortgage.fromJson(Map<String, dynamic> json) {
    // Property address: backend sends flat field, not nested object
    final propertyObj = json['property'];
    final propertyAddress = json['property_address']?.toString() ??
        (propertyObj is Map ? propertyObj['address']?.toString() : null) ??
        '';

    return Mortgage(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      applicationNumber: (json['application_number'] ?? '').toString(),
      propertyAddress: propertyAddress,
      propertyCity: (json['property_city'] ??
              (propertyObj is Map ? propertyObj['city'] : null) ??
              '').toString(),
      propertyState: (json['property_state'] ??
              (propertyObj is Map ? propertyObj['state'] : null) ??
              '').toString(),
      propertyLga: (json['property_lga'] ??
              (propertyObj is Map ? propertyObj['lga'] : null) ??
              '').toString(),
      propertyType: (json['property_type'] ?? '').toString(),
      propertyValue: (json['property_value'] ?? 0).toDouble(),
      loanAmount: (json['requested_amount'] ?? json['approved_amount'] ?? 0).toDouble(),
      downPayment: (json['down_payment'] ?? 0).toDouble(),
      loanTermMonths: (json['requested_tenor_months'] ?? json['approved_tenor_months'] ?? 0) as int,
      interestRate: (json['interest_rate'] ?? 0).toDouble(),
      monthlyPayment: (json['monthly_payment'] ?? 0).toDouble(),
      status: (json['status'] ?? '').toString(),
      productType: (json['product_type'] ?? '').toString(),
      interestType: (json['interest_type'] ?? '').toString(),
      applicantName: (json['applicant_name'] ?? '').toString(),
      applicantEmail: (json['applicant_email'] ?? '').toString(),
      applicantPhone: (json['applicant_phone'] ?? '').toString(),
      employmentStatus: (json['employment_status'] ?? '').toString(),
      monthlyIncome: (json['monthly_income'] ?? 0).toDouble(),
      titleType: (json['title_type'] ?? '').toString(),
      titleNumber: (json['title_number'] ?? '').toString(),
      underwritingScore: (json['underwriting_score'] ?? 0).toDouble(),
      applicationDate: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      approvalDate: json['approved_at'] != null
          ? DateTime.tryParse(json['approved_at'].toString())
          : null,
      description: json['description']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'application_number': applicationNumber,
      'property_address': propertyAddress,
      'property_city': propertyCity,
      'property_state': propertyState,
      'property_lga': propertyLga,
      'property_type': propertyType,
      'property_value': propertyValue,
      'requested_amount': loanAmount,
      'down_payment': downPayment,
      'requested_tenor_months': loanTermMonths,
      'interest_rate': interestRate,
      'monthly_payment': monthlyPayment,
      'status': status,
      'product_type': productType,
      'interest_type': interestType,
      'applicant_name': applicantName,
      'applicant_email': applicantEmail,
      'applicant_phone': applicantPhone,
      'employment_status': employmentStatus,
      'monthly_income': monthlyIncome,
      'title_type': titleType,
      'title_number': titleNumber,
      'created_at': applicationDate.toIso8601String(),
      'approved_at': approvalDate?.toIso8601String(),
      'description': description,
    };
  }

  double get totalInterest => (monthlyPayment * loanTermMonths) - loanAmount;
  double get totalPayment => monthlyPayment * loanTermMonths;
}
