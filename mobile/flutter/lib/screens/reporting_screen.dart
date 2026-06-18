import 'package:flutter/material.dart';

class ReportingScreen extends StatefulWidget {
  const ReportingScreen({super.key});
  @override
  State<ReportingScreen> createState() => _ReportingScreenState();
}

class _ReportingScreenState extends State<ReportingScreen> {
  final List<Map<String, dynamic>> _reports = [
    {'name': 'Daily P&L', 'category': 'Finance', 'format': 'PDF', 'schedule': 'Daily 06:00', 'lastGenerated': '2024-01-15', 'icon': Icons.attach_money},
    {'name': 'Loan Portfolio Report', 'category': 'Credit', 'format': 'Excel', 'schedule': 'Weekly', 'lastGenerated': '2024-01-12', 'icon': Icons.account_balance},
    {'name': 'Customer Acquisition', 'category': 'Marketing', 'format': 'PDF', 'schedule': 'Monthly', 'lastGenerated': '2024-01-01', 'icon': Icons.person_add},
    {'name': 'Fraud Analytics', 'category': 'Risk', 'format': 'PDF', 'schedule': 'Daily', 'lastGenerated': '2024-01-15', 'icon': Icons.security},
    {'name': 'Branch Performance', 'category': 'Operations', 'format': 'Excel', 'schedule': 'Monthly', 'lastGenerated': '2024-01-01', 'icon': Icons.store},
    {'name': 'Digital Channel Usage', 'category': 'Technology', 'format': 'PDF', 'schedule': 'Weekly', 'lastGenerated': '2024-01-12', 'icon': Icons.phone_android},
    {'name': 'Regulatory Compliance', 'category': 'Compliance', 'format': 'PDF', 'schedule': 'Quarterly', 'lastGenerated': '2023-12-31', 'icon': Icons.gavel},
    {'name': 'HR Attrition', 'category': 'HR', 'format': 'Excel', 'schedule': 'Monthly', 'lastGenerated': '2024-01-01', 'icon': Icons.people},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reports'), actions: [
        IconButton(icon: const Icon(Icons.add), onPressed: () {}, tooltip: 'Create Report'),
      ]),
      body: ListView.builder(itemCount: _reports.length, itemBuilder: (ctx, i) {
        final r = _reports[i];
        return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ListTile(
          leading: CircleAvatar(child: Icon(r['icon'] as IconData, size: 20)),
          title: Text(r['name'] as String), subtitle: Text('${r["category"]} | ${r["format"]} | ${r["schedule"]}\nLast: ${r["lastGenerated"]}'),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            IconButton(icon: const Icon(Icons.play_arrow, color: Colors.green), onPressed: () {}, tooltip: 'Generate Now'),
            IconButton(icon: const Icon(Icons.download), onPressed: () {}, tooltip: 'Download'),
          ]),
        ));
      }),
    );
  }
}
