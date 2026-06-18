/// Model to hold registration data across multiple steps
class RegistrationData {
  // Step 1: Personal Information
  String firstName;
  String lastName;
  String businessName;
  String email;

  // Step 2: Contact & Verification
  String phoneNumber;
  String? uin; // NIN - Optional

  // Step 3: Security
  String password;
  String confirmPassword;
  bool agreeToTerms;

  RegistrationData({
    this.firstName = '',
    this.lastName = '',
    this.businessName = '',
    this.email = '',
    this.phoneNumber = '',
    this.uin,
    this.password = '',
    this.confirmPassword = '',
    this.agreeToTerms = false,
  });

  /// Get the full name
  String get fullName => businessName.isNotEmpty ? '$firstName $lastName - $businessName'.trim() : '$firstName $lastName'.trim();

  /// Check if step 1 is complete
  bool get isStep1Complete =>
      firstName.isNotEmpty && lastName.isNotEmpty && email.isNotEmpty;

  /// Check if step 2 is complete
  bool get isStep2Complete => phoneNumber.isNotEmpty;

  /// Check if step 3 is complete
  bool get isStep3Complete =>
      password.isNotEmpty && confirmPassword.isNotEmpty && agreeToTerms;

  /// Get overall completion percentage (0.0 to 1.0)
  double get completionPercentage {
    int completedSteps = 0;
    if (isStep1Complete) completedSteps++;
    if (isStep2Complete) completedSteps++;
    if (isStep3Complete) completedSteps++;
    return completedSteps / 3.0;
  }

  @override
String toString() {
  return '''
RegistrationData {
  firstName: $firstName,
  lastName: $lastName,
  businessName: $businessName,
  email: $email,
  phoneNumber: $phoneNumber,
  uin: $uin,
  password: ${password.isNotEmpty ? '***' : ''},
  confirmPassword: ${confirmPassword.isNotEmpty ? '***' : ''},
  agreeToTerms: $agreeToTerms
}
''';
}

  /// Copy with method for immutability
  RegistrationData copyWith({
    String? firstName,
    String? lastName,
    String? businessName,
    String? email,
    String? phoneNumber,
    String? uin,
    String? password,
    String? confirmPassword,
    bool? agreeToTerms,
  }) {
    return RegistrationData(
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      businessName: businessName ?? this.businessName,
      email: email ?? this.email,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      uin: uin ?? this.uin,
      password: password ?? this.password,
      confirmPassword: confirmPassword ?? this.confirmPassword,
      agreeToTerms: agreeToTerms ?? this.agreeToTerms,
    );
  }
}
