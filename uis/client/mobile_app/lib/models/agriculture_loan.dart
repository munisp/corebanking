class AgricultureLoan {
  final String id;
  final String farmLocation;
  final double farmSize; // in hectares
  final String loanPurpose;
  final String? cropType;
  final String? livestockType;
  final double loanAmount;
  final int loanTerm; // in months
  final double interestRate;
  final String status;
  final DateTime applicationDate;
  final DateTime? approvalDate;
  final DateTime? harvestSeason;
  final String? description;

  AgricultureLoan({
    required this.id,
    required this.farmLocation,
    required this.farmSize,
    required this.loanPurpose,
    this.cropType,
    this.livestockType,
    required this.loanAmount,
    required this.loanTerm,
    required this.interestRate,
    required this.status,
    required this.applicationDate,
    this.approvalDate,
    this.harvestSeason,
    this.description,
  });

  factory AgricultureLoan.fromJson(Map<String, dynamic> json) {
    return AgricultureLoan(
      id: json['id'] ?? json['_id'] ?? '',
      farmLocation: json['farmLocation'] ?? '',
      farmSize: (json['farmSize'] ?? 0).toDouble(),
      loanPurpose: json['loanPurpose'] ?? '',
      cropType: json['cropType'],
      livestockType: json['livestockType'],
      loanAmount: (json['loanAmount'] ?? 0).toDouble(),
      loanTerm: json['loanTerm'] ?? 0,
      interestRate: (json['interestRate'] ?? 0).toDouble(),
      status: json['status'] ?? '',
      applicationDate: json['applicationDate'] != null
          ? DateTime.parse(json['applicationDate'])
          : DateTime.now(),
      approvalDate: json['approvalDate'] != null
          ? DateTime.parse(json['approvalDate'])
          : null,
      harvestSeason: json['harvestSeason'] != null
          ? DateTime.parse(json['harvestSeason'])
          : null,
      description: json['description'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farmLocation': farmLocation,
      'farmSize': farmSize,
      'loanPurpose': loanPurpose,
      'cropType': cropType,
      'livestockType': livestockType,
      'loanAmount': loanAmount,
      'loanTerm': loanTerm,
      'interestRate': interestRate,
      'status': status,
      'applicationDate': applicationDate.toIso8601String(),
      'approvalDate': approvalDate?.toIso8601String(),
      'harvestSeason': harvestSeason?.toIso8601String(),
      'description': description,
    };
  }
}
