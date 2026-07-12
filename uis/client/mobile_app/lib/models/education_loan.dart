class EducationLoan {
  final String id;
  final String institution;
  final String courseOfStudy;
  final String studyLevel;
  final double tuitionFees;
  final double livingExpenses;
  final double booksMaterials;
  final double totalAmount;
  final int loanTerm; // in years
  final double interestRate;
  final String status;
  final DateTime applicationDate;
  final DateTime? approvalDate;
  final DateTime courseStartDate;
  final DateTime courseEndDate;
  final String? description;

  EducationLoan({
    required this.id,
    required this.institution,
    required this.courseOfStudy,
    required this.studyLevel,
    required this.tuitionFees,
    required this.livingExpenses,
    required this.booksMaterials,
    required this.totalAmount,
    required this.loanTerm,
    required this.interestRate,
    required this.status,
    required this.applicationDate,
    this.approvalDate,
    required this.courseStartDate,
    required this.courseEndDate,
    this.description,
  });

  factory EducationLoan.fromJson(Map<String, dynamic> json) {
    return EducationLoan(
      id: json['id'] ?? json['_id'] ?? '',
      institution: json['institution'] ?? '',
      courseOfStudy: json['courseOfStudy'] ?? '',
      studyLevel: json['studyLevel'] ?? '',
      tuitionFees: (json['tuitionFees'] ?? 0).toDouble(),
      livingExpenses: (json['livingExpenses'] ?? 0).toDouble(),
      booksMaterials: (json['booksMaterials'] ?? 0).toDouble(),
      totalAmount: (json['totalAmount'] ?? 0).toDouble(),
      loanTerm: json['loanTerm'] ?? 0,
      interestRate: (json['interestRate'] ?? 0).toDouble(),
      status: json['status'] ?? '',
      applicationDate: json['applicationDate'] != null
          ? DateTime.parse(json['applicationDate'])
          : DateTime.now(),
      approvalDate: json['approvalDate'] != null
          ? DateTime.parse(json['approvalDate'])
          : null,
      courseStartDate: json['courseStartDate'] != null
          ? DateTime.parse(json['courseStartDate'])
          : DateTime.now(),
      courseEndDate: json['courseEndDate'] != null
          ? DateTime.parse(json['courseEndDate'])
          : DateTime.now(),
      description: json['description'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'institution': institution,
      'courseOfStudy': courseOfStudy,
      'studyLevel': studyLevel,
      'tuitionFees': tuitionFees,
      'livingExpenses': livingExpenses,
      'booksMaterials': booksMaterials,
      'totalAmount': totalAmount,
      'loanTerm': loanTerm,
      'interestRate': interestRate,
      'status': status,
      'applicationDate': applicationDate.toIso8601String(),
      'approvalDate': approvalDate?.toIso8601String(),
      'courseStartDate': courseStartDate.toIso8601String(),
      'courseEndDate': courseEndDate.toIso8601String(),
      'description': description,
    };
  }
}
