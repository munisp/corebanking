import 'package:flutter/material.dart';

class ReportGenerationScreen extends StatefulWidget {
  const ReportGenerationScreen({super.key});
  @override
  State<ReportGenerationScreen> createState() => _ReportGenerationScreenState();
}

class _ReportGenerationScreenState extends State<ReportGenerationScreen> {
  final List<Map<String, dynamic>> _reports = [
    {'name': 'CBN Returns (Weekly)', 'category': 'Regulatory', 'lastRun': '2024-01-26', 'nextDue': '2024-02-02', 'status': 'scheduled'},
    {'name': 'NDIC Premium Report', 'category': 'Regulatory', 'lastRun': '2024-01-15', 'nextDue': '2024-02-15', 'status': 'scheduled'},
    {'name': 'NFIU CTR Report', 'category': 'Compliance', 'lastRun': '2024-01-28', 'nextDue': '2024-01-29', 'status': 'due_today'},
    {'name': 'Daily P&L', 'category': 'Finance', 'lastRun': '2024-01-28', 'nextDue': '2024-01-29', 'status': 'scheduled'},
    {'name': 'Loan Portfolio Analysis', 'category': 'Risk', 'lastRun': '2024-01-20', 'nextDue': '2024-02-20', 'status': 'scheduled'},
    {'name': 'KYC Completion Report', 'category': 'Operations', 'lastRun': '2024-01-27', 'nextDue': '2024-02-03', 'status': 'scheduled'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Report Generation')),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _reports.length,
        itemBuilder: (ctx, i) {
          final r = _reports[i];
          bool isDue = r['status'] == 'due_today';
          return Card(
            color: isDue ? Colors.red.shade50 : null,
            child: ListTile(
              leading: CircleAvatar(backgroundColor: isDue ? Colors.red : Colors.blue,
                child: Icon(Icons.description, color: Colors.white, size: 18)),
              title: Text(r['name']),
              subtitle: Text('${r["category"]} | Last: ${r["lastRun"]} | Next: ${r["nextDue"]}'),
              trailing: OutlinedButton(onPressed: () {}, child: const Text('Run', style: TextStyle(fontSize: 12))),
            ),
          );
        },
      ),
    );
  }
}
