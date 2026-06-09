import 'package:flutter/material.dart';

class ComplianceChecksScreen extends StatefulWidget {
  const ComplianceChecksScreen({super.key});
  @override
  State<ComplianceChecksScreen> createState() => _ComplianceChecksScreenState();
}

class _ComplianceChecksScreenState extends State<ComplianceChecksScreen> {
  final List<Map<String, dynamic>> _checks = [
    {'name': 'OFAC Screening', 'lastRun': '2024-01-15 14:30', 'status': 'Pass', 'hits': 0, 'coverage': 100},
    {'name': 'EU Sanctions List', 'lastRun': '2024-01-15 14:30', 'status': 'Pass', 'hits': 0, 'coverage': 100},
    {'name': 'UN Consolidated List', 'lastRun': '2024-01-15 14:30', 'status': 'Pass', 'hits': 0, 'coverage': 100},
    {'name': 'PEP Screening', 'lastRun': '2024-01-15 14:30', 'status': 'Alert', 'hits': 3, 'coverage': 98},
    {'name': 'NFIU Watchlist', 'lastRun': '2024-01-15 14:30', 'status': 'Pass', 'hits': 0, 'coverage': 100},
    {'name': 'Adverse Media', 'lastRun': '2024-01-15 10:00', 'status': 'Alert', 'hits': 7, 'coverage': 95},
    {'name': 'KYC Completeness', 'lastRun': '2024-01-15 08:00', 'status': 'Warning', 'hits': 234, 'coverage': 87},
    {'name': 'Transaction Monitoring', 'lastRun': '2024-01-15 14:30', 'status': 'Alert', 'hits': 12, 'coverage': 100},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Compliance Checks'), backgroundColor: Colors.red[800]),
      body: Column(children: [
        Container(padding: const EdgeInsets.all(16), color: Colors.red[50], child: Row(children: [
          Expanded(child: _stat('Pass', '${_checks.where((c) => c["status"] == "Pass").length}', Colors.green)),
          Expanded(child: _stat('Alerts', '${_checks.where((c) => c["status"] == "Alert").length}', Colors.orange)),
          Expanded(child: _stat('Warnings', '${_checks.where((c) => c["status"] == "Warning").length}', Colors.red)),
          Expanded(child: _stat('Total Hits', '${_checks.fold<int>(0, (s, c) => s + (c["hits"] as int))}', Colors.purple)),
        ])),
        Expanded(child: ListView.builder(itemCount: _checks.length, itemBuilder: (ctx, i) {
          final c = _checks[i];
          final color = c['status'] == 'Pass' ? Colors.green : c['status'] == 'Alert' ? Colors.orange : Colors.red;
          return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2), child: ListTile(
            leading: Icon(c['status'] == 'Pass' ? Icons.check_circle : Icons.warning, color: color),
            title: Text(c['name'] as String), subtitle: Text('Last: ${c["lastRun"]} | Hits: ${c["hits"]} | Coverage: ${c["coverage"]}%'),
            trailing: Chip(label: Text(c['status'] as String, style: TextStyle(color: color, fontSize: 11)), backgroundColor: color.withOpacity(0.1)),
          ));
        })),
      ]),
    );
  }

  Widget _stat(String label, String value, Color color) {
    return Column(children: [Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)), Text(label, style: const TextStyle(fontSize: 11))]);
  }
}
