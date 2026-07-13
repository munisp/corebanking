import 'package:flutter/material.dart';

/// 54Bank Security Alerts — Flutter
/// Push notification-driven security alert viewer for mobile security officers.
/// Shows PAM approvals, UEBA anomalies, canary triggers, break-glass events,
/// and DLP blocks with real-time push notifications.

class SecurityAlertsScreen extends StatefulWidget {
  const SecurityAlertsScreen({Key? key}) : super(key: key);

  @override
  State<SecurityAlertsScreen> createState() => _SecurityAlertsScreenState();
}

class _SecurityAlertsScreenState extends State<SecurityAlertsScreen> {
  final List<SecurityAlert> _alerts = [
    SecurityAlert(id: 'SA-001', type: 'pam_approval', title: 'PAM Approval Required', body: 'john.doe requests database:core_banking access (60 min)', severity: 'high', timestamp: DateTime.now().subtract(const Duration(minutes: 5)), actionRequired: true),
    SecurityAlert(id: 'SA-002', type: 'ueba_anomaly', title: 'UEBA: Unusual Login', body: 'emp-042 logged in at 03:15 AM from unknown device', severity: 'high', timestamp: DateTime.now().subtract(const Duration(minutes: 12))),
    SecurityAlert(id: 'SA-003', type: 'canary_trigger', title: 'CANARY TOKEN TRIGGERED', body: 'Legacy API Key (CANARY-KEY-001) accessed by emp-108', severity: 'critical', timestamp: DateTime.now().subtract(const Duration(minutes: 30))),
    SecurityAlert(id: 'SA-004', type: 'dlp_block', title: 'DLP: Bulk Query Blocked', body: 'emp-077 attempted to export 15,000 customer records', severity: 'critical', timestamp: DateTime.now().subtract(const Duration(hours: 1))),
    SecurityAlert(id: 'SA-005', type: 'velocity', title: 'Velocity Limit Exceeded', body: 'emp-033 exceeded 1-hour transaction count limit (52/50)', severity: 'medium', timestamp: DateTime.now().subtract(const Duration(hours: 2))),
    SecurityAlert(id: 'SA-006', type: 'self_dealing', title: 'Self-Dealing Detected', body: 'emp-091 processed transfer to family member account', severity: 'critical', timestamp: DateTime.now().subtract(const Duration(hours: 3))),
    SecurityAlert(id: 'SA-007', type: 'dormant', title: 'Dormant Account Reactivated', body: 'ACCT-D003 reactivated by emp-055 (720 days dormant)', severity: 'high', timestamp: DateTime.now().subtract(const Duration(hours: 4))),
    SecurityAlert(id: 'SA-008', type: 'credential', title: 'Stale Credential Warning', body: 'gl-engine-db password expires in 2 days', severity: 'medium', timestamp: DateTime.now().subtract(const Duration(hours: 6))),
  ];

  String _filterSeverity = 'all';

  List<SecurityAlert> get _filteredAlerts {
    if (_filterSeverity == 'all') return _alerts;
    return _alerts.where((a) => a.severity == _filterSeverity).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Security Alerts'),
        backgroundColor: const Color(0xFF1A1A2E),
        foregroundColor: Colors.white,
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.filter_list),
            onSelected: (v) => setState(() => _filterSeverity = v),
            itemBuilder: (ctx) => [
              const PopupMenuItem(value: 'all', child: Text('All')),
              const PopupMenuItem(value: 'critical', child: Text('Critical')),
              const PopupMenuItem(value: 'high', child: Text('High')),
              const PopupMenuItem(value: 'medium', child: Text('Medium')),
            ],
          ),
        ],
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _filteredAlerts.length,
        itemBuilder: (ctx, i) => _buildAlertCard(_filteredAlerts[i]),
      ),
    );
  }

  Widget _buildAlertCard(SecurityAlert alert) {
    final severityColor = {'critical': Colors.red, 'high': Colors.orange, 'medium': Colors.amber}[alert.severity] ?? Colors.grey;
    final typeIcon = {
      'pam_approval': Icons.lock_open, 'ueba_anomaly': Icons.psychology,
      'canary_trigger': Icons.pest_control, 'dlp_block': Icons.shield,
      'velocity': Icons.speed, 'self_dealing': Icons.people,
      'dormant': Icons.hotel, 'credential': Icons.key,
    }[alert.type] ?? Icons.warning;

    final timeAgo = DateTime.now().difference(alert.timestamp);
    final timeStr = timeAgo.inHours > 0 ? '${timeAgo.inHours}h ago' : '${timeAgo.inMinutes}m ago';

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: alert.severity == 'critical' ? Colors.red.shade50 : null,
      child: ListTile(
        leading: CircleAvatar(backgroundColor: severityColor, child: Icon(typeIcon, color: Colors.white, size: 20)),
        title: Text(alert.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(alert.body, style: const TextStyle(fontSize: 12)),
            const SizedBox(height: 4),
            Text(timeStr, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          ],
        ),
        trailing: alert.actionRequired
            ? ElevatedButton(
                onPressed: () {},
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1A1A2E),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  minimumSize: Size.zero,
                ),
                child: const Text('Review', style: TextStyle(fontSize: 11, color: Colors.white)),
              )
            : Chip(
                label: Text(alert.severity.toUpperCase(), style: const TextStyle(fontSize: 9, color: Colors.white)),
                backgroundColor: severityColor,
                padding: EdgeInsets.zero,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
        isThreeLine: true,
      ),
    );
  }
}

class SecurityAlert {
  final String id;
  final String type;
  final String title;
  final String body;
  final String severity;
  final DateTime timestamp;
  final bool actionRequired;

  SecurityAlert({
    required this.id, required this.type, required this.title,
    required this.body, required this.severity, required this.timestamp,
    this.actionRequired = false,
  });
}
