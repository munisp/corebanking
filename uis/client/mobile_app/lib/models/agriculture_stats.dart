class AgricultureStats {
  final int totalDevices;
  final int activeDevices;
  final int totalOrders;
  final int pendingOrders;
  final int totalInstallations;
  final int farmsWithTech;
  final int totalReadings;
  final int reportsGenerated;

  AgricultureStats({
    required this.totalDevices,
    required this.activeDevices,
    required this.totalOrders,
    required this.pendingOrders,
    required this.totalInstallations,
    required this.farmsWithTech,
    required this.totalReadings,
    required this.reportsGenerated,
  });

  factory AgricultureStats.fromJson(Map<String, dynamic> json) {
    return AgricultureStats(
      totalDevices: json['TotalDevices'] ?? 0,
      activeDevices: json['ActiveDevices'] ?? 0,
      totalOrders: json['TotalOrders'] ?? 0,
      pendingOrders: json['PendingOrders'] ?? 0,
      totalInstallations: json['TotalInstallations'] ?? 0,
      farmsWithTech: json['FarmsWithTech'] ?? 0,
      totalReadings: json['TotalReadings'] ?? 0,
      reportsGenerated: json['ReportsGenerated'] ?? 0,
    );
  }
}
