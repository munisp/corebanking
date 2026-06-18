class CropBreakdown {
  final String cropType;
  final double nplRatio;
  final int loanCount;
  final double totalDisbursed;

  CropBreakdown({
    required this.cropType,
    required this.nplRatio,
    required this.loanCount,
    required this.totalDisbursed,
  });

  factory CropBreakdown.fromJson(Map<String, dynamic> json) {
    return CropBreakdown(
      cropType: json['cropType'] ?? '',
      nplRatio: (json['nplRatio'] ?? 0).toDouble(),
      loanCount: json['loanCount'] ?? 0,
      totalDisbursed: (json['totalDisbursed'] ?? 0).toDouble(),
    );
  }
}
