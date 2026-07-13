class Cheque {
  final String id;
  final String userId;
  final String accountId;
  final String chequeNumber;
  final String status; // requested, issued, delivered, stopped, used
  final DateTime requestDate;
  final DateTime? issueDate;
  final DateTime? deliveryDate;
  final int numberOfLeaves;
  final String deliveryMethod; // branch, courier
  final String? deliveryAddress;
  final String? branchName;
  final String? stopReason;
  final DateTime? stopDate;

  Cheque({
    required this.id,
    required this.userId,
    required this.accountId,
    required this.chequeNumber,
    required this.status,
    required this.requestDate,
    this.issueDate,
    this.deliveryDate,
    required this.numberOfLeaves,
    required this.deliveryMethod,
    this.deliveryAddress,
    this.branchName,
    this.stopReason,
    this.stopDate,
  });

  factory Cheque.fromJson(Map<String, dynamic> json) {
    return Cheque(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? '',
      accountId: json['account_id'] ?? '',
      chequeNumber: json['cheque_number'] ?? '',
      status: json['status'] ?? 'requested',
      requestDate: json['request_date'] != null
          ? DateTime.parse(json['request_date'])
          : DateTime.now(),
      issueDate: json['issue_date'] != null
          ? DateTime.parse(json['issue_date'])
          : null,
      deliveryDate: json['delivery_date'] != null
          ? DateTime.parse(json['delivery_date'])
          : null,
      numberOfLeaves: json['number_of_leaves'] ?? 0,
      deliveryMethod: json['delivery_method'] ?? 'branch',
      deliveryAddress: json['delivery_address'],
      branchName: json['branch_name'],
      stopReason: json['stop_reason'],
      stopDate: json['stop_date'] != null
          ? DateTime.parse(json['stop_date'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'account_id': accountId,
      'cheque_number': chequeNumber,
      'status': status,
      'request_date': requestDate.toIso8601String(),
      'issue_date': issueDate?.toIso8601String(),
      'delivery_date': deliveryDate?.toIso8601String(),
      'number_of_leaves': numberOfLeaves,
      'delivery_method': deliveryMethod,
      'delivery_address': deliveryAddress,
      'branch_name': branchName,
      'stop_reason': stopReason,
      'stop_date': stopDate?.toIso8601String(),
    };
  }

  Cheque copyWith({
    String? id,
    String? userId,
    String? accountId,
    String? chequeNumber,
    String? status,
    DateTime? requestDate,
    DateTime? issueDate,
    DateTime? deliveryDate,
    int? numberOfLeaves,
    String? deliveryMethod,
    String? deliveryAddress,
    String? branchName,
    String? stopReason,
    DateTime? stopDate,
  }) {
    return Cheque(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      accountId: accountId ?? this.accountId,
      chequeNumber: chequeNumber ?? this.chequeNumber,
      status: status ?? this.status,
      requestDate: requestDate ?? this.requestDate,
      issueDate: issueDate ?? this.issueDate,
      deliveryDate: deliveryDate ?? this.deliveryDate,
      numberOfLeaves: numberOfLeaves ?? this.numberOfLeaves,
      deliveryMethod: deliveryMethod ?? this.deliveryMethod,
      deliveryAddress: deliveryAddress ?? this.deliveryAddress,
      branchName: branchName ?? this.branchName,
      stopReason: stopReason ?? this.stopReason,
      stopDate: stopDate ?? this.stopDate,
    );
  }

  String get statusText {
    switch (status) {
      case 'requested':
        return 'Requested';
      case 'issued':
        return 'Issued';
      case 'delivered':
        return 'Delivered';
      case 'stopped':
        return 'Stopped';
      case 'used':
        return 'Used';
      default:
        return 'Unknown';
    }
  }
}
