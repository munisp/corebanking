class Institution {
  final String id;
  final String name;
  final String type;
  final bool nucAccredited;
  final String accreditationNumber;
  final String country;
  final String state;
  final String city;
  final String address;
  final String bankAccountNumber;
  final String bankName;
  final String bankCode;
  final String contactPerson;
  final String contactEmail;
  final String contactPhone;
  final String verificationStatus;

  Institution({
    this.id = '',
    this.name = '',
    this.type = '',
    this.nucAccredited = false,
    this.accreditationNumber = '',
    this.country = '',
    this.state = '',
    this.city = '',
    this.address = '',
    this.bankAccountNumber = '',
    this.bankName = '',
    this.bankCode = '',
    this.contactPerson = '',
    this.contactEmail = '',
    this.contactPhone = '',
    this.verificationStatus = '',
  });

  factory Institution.fromJson(Map<String, dynamic> json) {
    return Institution(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      type: json['type'] as String? ?? '',
      nucAccredited: json['nuc_accredited'] as bool? ?? false,
      accreditationNumber: json['accreditation_number'] as String? ?? '',
      country: json['country'] as String? ?? '',
      state: json['state'] as String? ?? '',
      city: json['city'] as String? ?? '',
      address: json['address'] as String? ?? '',
      bankAccountNumber: json['bank_account_number'] as String? ?? '',
      bankName: json['bank_name'] as String? ?? '',
      bankCode: json['bank_code'] as String? ?? '',
      contactPerson: json['contact_person'] as String? ?? '',
      contactEmail: json['contact_email'] as String? ?? '',
      contactPhone: json['contact_phone'] as String? ?? '',
      verificationStatus: json['verification_status'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type,
      'nuc_accredited': nucAccredited,
      'accreditation_number': accreditationNumber,
      'country': country,
      'state': state,
      'city': city,
      'address': address,
      'bank_account_number': bankAccountNumber,
      'bank_name': bankName,
      'bank_code': bankCode,
      'contact_person': contactPerson,
      'contact_email': contactEmail,
      'contact_phone': contactPhone,
      'verification_status': verificationStatus,
    };
  }
}

class EducationLoanApplication {
  final String id;
  final String tenantId;
  final String applicationNumber;
  final String status;
  final String loanType;
  final String studentId;
  final String applicantName;
  final String studentBvn;
  final String studentNin;
  final String studentEmail;
  final String studentPhone;
  final DateTime? dateOfBirth;
  final String gender;
  final String stateOfOrigin;
  final String lga;
  final Institution institution;
  final String programName;
  final int programDurationYears;
  final int currentYear;
  final DateTime? expectedGraduation;
  final String admissionNumber;
  final String admissionLetterId;
  final double tuitionFeePerYear;
  final double accommodationPerYear;
  final double booksAndMaterials;
  final double livingExpenses;
  final double totalCostPerYear;
  final double amount;
  final double approvedAmount;
  final double disbursedAmount;
  final double outstandingBalance;
  final double interestRate;
  final String repaymentType;
  final int moratoriumMonths;
  final int repaymentTenorMonths;
  final double monthlyPayment;
  final List<dynamic>? guarantors;
  final List<dynamic>? disbursementSchedule;
  final String principalAccountId;
  final String interestAccountId;
  final String disbursementAccountId;
  final String? offerDetails;
  final DateTime createdAt;
  final DateTime? updatedAt;

  EducationLoanApplication({
    required this.id,
    this.tenantId = '',
    this.applicationNumber = '',
    required this.status,
    this.loanType = 'personal',
    this.studentId = '',
    required this.applicantName,
    this.studentBvn = '',
    this.studentNin = '',
    this.studentEmail = '',
    this.studentPhone = '',
    this.dateOfBirth,
    this.gender = '',
    this.stateOfOrigin = '',
    this.lga = '',
    Institution? institution,
    this.programName = '',
    this.programDurationYears = 0,
    this.currentYear = 0,
    this.expectedGraduation,
    this.admissionNumber = '',
    this.admissionLetterId = '',
    this.tuitionFeePerYear = 0.0,
    this.accommodationPerYear = 0.0,
    this.booksAndMaterials = 0.0,
    this.livingExpenses = 0.0,
    this.totalCostPerYear = 0.0,
    required this.amount,
    this.approvedAmount = 0.0,
    this.disbursedAmount = 0.0,
    this.outstandingBalance = 0.0,
    this.interestRate = 0.0,
    this.repaymentType = '',
    this.moratoriumMonths = 0,
    this.repaymentTenorMonths = 0,
    this.monthlyPayment = 0.0,
    this.guarantors,
    this.disbursementSchedule,
    this.principalAccountId = '',
    this.interestAccountId = '',
    this.disbursementAccountId = '',
    this.offerDetails,
    required this.createdAt,
    this.updatedAt,
  }) : institution = institution ?? Institution();

  factory EducationLoanApplication.fromJson(Map<String, dynamic> json) {
    DateTime? parseDateSafely(dynamic dateStr) {
      if (dateStr == null || dateStr == '') return null;
      try {
        final parsed = DateTime.parse(dateStr as String);
        // Check if it's the zero date (0001-01-01)
        if (parsed.year == 1) return null;
        return parsed;
      } catch (e) {
        return null;
      }
    }

    return EducationLoanApplication(
      id: json['id'] as String? ?? '',
      tenantId: json['tenant_id'] as String? ?? '',
      applicationNumber: json['application_number'] as String? ?? '',
      status: json['status'] as String? ?? 'draft',
      loanType: json['loan_type'] as String? ?? 'personal',
      studentId: json['student_id'] as String? ?? '',
      applicantName: json['student_name'] as String? ?? 'N/A',
      studentBvn: json['student_bvn'] as String? ?? '',
      studentNin: json['student_nin'] as String? ?? '',
      studentEmail: json['student_email'] as String? ?? '',
      studentPhone: json['student_phone'] as String? ?? '',
      dateOfBirth: parseDateSafely(json['date_of_birth']),
      gender: json['gender'] as String? ?? '',
      stateOfOrigin: json['state_of_origin'] as String? ?? '',
      lga: json['lga'] as String? ?? '',
      institution: json['institution'] != null 
          ? Institution.fromJson(json['institution'] as Map<String, dynamic>)
          : Institution(),
      programName: json['program_name'] as String? ?? '',
      programDurationYears: json['program_duration_years'] as int? ?? 0,
      currentYear: json['current_year'] as int? ?? 0,
      expectedGraduation: parseDateSafely(json['expected_graduation']),
      admissionNumber: json['admission_number'] as String? ?? '',
      admissionLetterId: json['admission_letter_id'] as String? ?? '',
      tuitionFeePerYear: (json['tuition_fee_per_year'] as num?)?.toDouble() ?? 0.0,
      accommodationPerYear: (json['accommodation_per_year'] as num?)?.toDouble() ?? 0.0,
      booksAndMaterials: (json['books_and_materials'] as num?)?.toDouble() ?? 0.0,
      livingExpenses: (json['living_expenses'] as num?)?.toDouble() ?? 0.0,
      totalCostPerYear: (json['total_cost_per_year'] as num?)?.toDouble() ?? 0.0,
      amount: (json['requested_amount'] as num?)?.toDouble() ?? 0.0,
      approvedAmount: (json['approved_amount'] as num?)?.toDouble() ?? 0.0,
      disbursedAmount: (json['disbursed_amount'] as num?)?.toDouble() ?? 0.0,
      outstandingBalance: (json['outstanding_balance'] as num?)?.toDouble() ?? 0.0,
      interestRate: (json['interest_rate'] as num?)?.toDouble() ?? 0.0,
      repaymentType: json['repayment_type'] as String? ?? '',
      moratoriumMonths: json['moratorium_months'] as int? ?? 0,
      repaymentTenorMonths: json['repayment_tenor_months'] as int? ?? 0,
      monthlyPayment: (json['monthly_payment'] as num?)?.toDouble() ?? 0.0,
      guarantors: json['guarantors'] as List<dynamic>?,
      disbursementSchedule: json['disbursement_schedule'] as List<dynamic>?,
      principalAccountId: json['principal_account_id'] as String? ?? '',
      interestAccountId: json['interest_account_id'] as String? ?? '',
      disbursementAccountId: json['disbursement_account_id'] as String? ?? '',
      offerDetails: json['offerDetails'] as String?,
      createdAt: parseDateSafely(json['created_at']) ?? DateTime.now(),
      updatedAt: parseDateSafely(json['updated_at']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'tenant_id': tenantId,
      'application_number': applicationNumber,
      'status': status,
      'loan_type': loanType,
      'student_id': studentId,
      'student_name': applicantName,
      'student_bvn': studentBvn,
      'student_nin': studentNin,
      'student_email': studentEmail,
      'student_phone': studentPhone,
      'date_of_birth': dateOfBirth?.toIso8601String(),
      'gender': gender,
      'state_of_origin': stateOfOrigin,
      'lga': lga,
      'institution': institution.toJson(),
      'program_name': programName,
      'program_duration_years': programDurationYears,
      'current_year': currentYear,
      'expected_graduation': expectedGraduation?.toIso8601String(),
      'admission_number': admissionNumber,
      'admission_letter_id': admissionLetterId,
      'tuition_fee_per_year': tuitionFeePerYear,
      'accommodation_per_year': accommodationPerYear,
      'books_and_materials': booksAndMaterials,
      'living_expenses': livingExpenses,
      'total_cost_per_year': totalCostPerYear,
      'requested_amount': amount,
      'approved_amount': approvedAmount,
      'disbursed_amount': disbursedAmount,
      'outstanding_balance': outstandingBalance,
      'interest_rate': interestRate,
      'repayment_type': repaymentType,
      'moratorium_months': moratoriumMonths,
      'repayment_tenor_months': repaymentTenorMonths,
      'monthly_payment': monthlyPayment,
      'guarantors': guarantors,
      'disbursement_schedule': disbursementSchedule,
      'principal_account_id': principalAccountId,
      'interest_account_id': interestAccountId,
      'disbursement_account_id': disbursementAccountId,
      'offerDetails': offerDetails,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }
}