import 'package:flutter/material.dart';

class RegulatoryReportingScreen extends StatefulWidget {
  const RegulatoryReportingScreen({super.key});
  @override
  State<RegulatoryReportingScreen> createState() => _RegulatoryReportingScreenState();
}

class _RegulatoryReportingScreenState extends State<RegulatoryReportingScreen> {
  final List<Map<String, dynamic>> _reports = [
    {'name': 'CBN Weekly Returns', 'regulator': 'CBN', 'frequency': 'Weekly', 'nextDue': '2024-01-19', 'status': 'On Track'},
    {'name': 'NDIC Premium Computation', 'regulator': 'NDIC', 'frequency': 'Semi-Annual', 'nextDue': '2024-06-30', 'status': 'On Track'},
    {'name': 'NFIU CTR Summary', 'regulator': 'NFIU', 'frequency': 'Monthly', 'nextDue': '2024-02-05', 'status': 'On Track'},
    {'name': 'SEC Asset Management Report', 'regulator': 'SEC', 'frequency': 'Quarterly', 'nextDue': '2024-01-31', 'status': 'In Progress'},
    {'name': 'FIRS Tax Returns', 'regulator': 'FIRS', 'frequency': 'Monthly', 'nextDue': '2024-02-21', 'status': 'On Track'},
    {'name': 'PENCOM Remittance Report', 'regulator': 'PENCOM', 'frequency': 'Monthly', 'nextDue': '2024-02-10', 'status': 'On Track'},
    {'name': 'NSE Disclosure', 'regulator': 'NSE', 'frequency': 'Quarterly', 'nextDue': '2024-01-31', 'status': 'Draft'},
    {'name': 'IFRS Disclosures', 'regulator': 'IASB', 'frequency': 'Annual', 'nextDue': '2024-03-31', 'status': 'Pending'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Regulatory Reporting')),
      body: ListView.builder(itemCount: _reports.length, itemBuilder: (ctx, i) {
        final r = _reports[i];
        final statusColor = r['status'] == 'On Track' ? Colors.green : r['status'] == 'In Progress' ? Colors.blue : r['status'] == 'Draft' ? Colors.orange : Colors.grey;
        return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ListTile(
          leading: CircleAvatar(child: Text(r['regulator'] as String, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold))),
          title: Text(r['name'] as String), subtitle: Text('${r["frequency"]} | Due: ${r["nextDue"]}'),
          trailing: Chip(label: Text(r['status'] as String, style: TextStyle(color: statusColor, fontSize: 11)), backgroundColor: statusColor.withOpacity(0.1)),
        ));
      }),
    );
  }
}
