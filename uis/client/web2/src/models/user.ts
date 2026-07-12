export interface UserJson {
  id?: string;
  user_id?: string;
  email?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  phone_number?: string;
  phoneNumber?: string;
  account_number?: string;
  accountNumber?: string;
  bvn?: string;
  profile_image?: string;
  profileImage?: string;
  status?: string;
  is_verified?: boolean;
  isVerified?: boolean;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export class User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  accountNumber?: string;
  bvn?: string;
  profileImage?: string;
  status: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt?: Date;

  constructor(data: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    accountNumber?: string;
    bvn?: string;
    profileImage?: string;
    status: string;
    isVerified: boolean;
    createdAt: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.email = data.email;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.phoneNumber = data.phoneNumber;
    this.accountNumber = data.accountNumber;
    this.bvn = data.bvn;
    this.profileImage = data.profileImage;
    this.status = data.status;
    this.isVerified = data.isVerified;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  static fromJson(json: UserJson): User {
    return new User({
      id: json.id ?? json.user_id ?? '',
      email: json.email ?? '',
      firstName: json.first_name ?? json.firstName ?? '',
      lastName: json.last_name ?? json.lastName ?? '',
      phoneNumber: json.phone_number ?? json.phoneNumber,
      accountNumber: json.account_number ?? json.accountNumber,
      bvn: json.bvn,
      profileImage: json.profile_image ?? json.profileImage,
      status: json.status ?? 'active',
      isVerified: json.is_verified ?? json.isVerified ?? false,
      createdAt: new Date(json.created_at ?? json.createdAt ?? new Date().toISOString()),
      updatedAt: json.updated_at || json.updatedAt ? new Date(json.updated_at ?? json.updatedAt!) : undefined,
    });
  }

  toJson(): UserJson {
    return {
      id: this.id,
      email: this.email,
      first_name: this.firstName,
      last_name: this.lastName,
      phone_number: this.phoneNumber,
      account_number: this.accountNumber,
      bvn: this.bvn,
      profile_image: this.profileImage,
      status: this.status,
      is_verified: this.isVerified,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt?.toISOString(),
    };
  }

  copyWith(data: Partial<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    accountNumber?: string;
    bvn?: string;
    profileImage?: string;
    status: string;
    isVerified: boolean;
    createdAt: Date;
    updatedAt?: Date;
  }>): User {
    return new User({
      id: data.id ?? this.id,
      email: data.email ?? this.email,
      firstName: data.firstName ?? this.firstName,
      lastName: data.lastName ?? this.lastName,
      phoneNumber: data.phoneNumber ?? this.phoneNumber,
      accountNumber: data.accountNumber ?? this.accountNumber,
      bvn: data.bvn ?? this.bvn,
      profileImage: data.profileImage ?? this.profileImage,
      status: data.status ?? this.status,
      isVerified: data.isVerified ?? this.isVerified,
      createdAt: data.createdAt ?? this.createdAt,
      updatedAt: data.updatedAt ?? this.updatedAt,
    });
  }
}
