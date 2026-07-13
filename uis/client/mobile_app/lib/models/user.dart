class User {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String? phoneNumber;
  final String? accountNumber;
  final String? bvn;
  final String? profileImage;
  final String status;
  final bool isVerified;
  final String? kycVerificationUrl;
  final DateTime createdAt;
  final DateTime? updatedAt;

  User({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.phoneNumber,
    this.accountNumber,
    this.bvn,
    this.profileImage,
    required this.status,
    required this.isVerified,
    this.kycVerificationUrl,
    required this.createdAt,
    this.updatedAt,
  });

  String get fullName => '$firstName $lastName';

  factory User.fromJson(Map<String, dynamic> json) {
    // Handle isVerified from multiple possible fields
    bool verified = false;
    if (json.containsKey('kyc_verification_status')) {
      verified = json['kyc_verification_status'] == "verified";
    } else if (json.containsKey('is_verified')) {
      verified = json['is_verified'] == true || json['is_verified'] == 'true';
    } else if (json.containsKey('isVerified')) {
      verified = json['isVerified'] == true || json['isVerified'] == 'true';
    }
    
    return User(
      id: json['id'] ?? json['user_id'] ?? '',
      email: json['email'] ?? '',
      firstName: json['first_name'] ?? json['firstName'] ?? '',
      lastName: json['last_name'] ?? json['lastName'] ?? '',
      phoneNumber: json['phone_number'] ?? json['phoneNumber'],
      accountNumber: json['account_number'] ?? json['accountNumber'],
      bvn: json['bvn'],
      profileImage: json['profile_image'] ?? json['profileImage'],
      status: json['status'] ?? 'active',
      isVerified: verified,
      kycVerificationUrl: json['kyc_verification_url'],
      createdAt: DateTime.parse(json['created_at'] ?? json['createdAt'] ?? DateTime.now().toIso8601String()),
      updatedAt: json['updated_at'] != null || json['updatedAt'] != null
          ? DateTime.parse(json['updated_at'] ?? json['updatedAt'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'first_name': firstName,
      'last_name': lastName,
      'phone_number': phoneNumber,
      'account_number': accountNumber,
      'bvn': bvn,
      'profile_image': profileImage,
      'status': status,
      'is_verified': isVerified,
      'kyc_verification_url': kycVerificationUrl,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  User copyWith({
    String? id,
    String? email,
    String? firstName,
    String? lastName,
    String? phoneNumber,
    String? accountNumber,
    String? bvn,
    String? profileImage,
    String? status,
    bool? isVerified,
    String? kycVerificationUrl,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return User(
      id: id ?? this.id,
      email: email ?? this.email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      accountNumber: accountNumber ?? this.accountNumber,
      bvn: bvn ?? this.bvn,
      profileImage: profileImage ?? this.profileImage,
      status: status ?? this.status,
      isVerified: isVerified ?? this.isVerified,
      kycVerificationUrl: kycVerificationUrl ?? this.kycVerificationUrl,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
