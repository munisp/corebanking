class RiskAlert {
  final String id;
  final String message;
  final String severity;
  final bool acknowledged;

  RiskAlert({
    required this.id,
    required this.message,
    required this.severity,
    required this.acknowledged,
  });

  factory RiskAlert.fromJson(Map<String, dynamic> json) {
    return RiskAlert(
      id: json['id'] ?? '',
      message: json['message'] ?? '',
      severity: json['severity'] ?? 'low',
      acknowledged: json['acknowledged'] ?? false,
    );
  }
}
