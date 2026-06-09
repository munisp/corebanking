import 'package:flutter/material.dart';

class CbnReturnsScreen extends StatefulWidget {
  const CbnReturnsScreen({super.key});
  @override
  State<CbnReturnsScreen> createState() => _CbnReturnsScreenState();
}

class _CbnReturnsScreenState extends State<CbnReturnsScreen> {
  final List<Map<String, dynamic>> _returns = [
    {'name': 'Weekly Returns (Form A)', 'frequency': 'Weekly', 'dueDate': '2024-01-19', 'status': 'Submitted', 'period': 'Week 2'},
    {'name': 'Monthly Statement of Affairs', 'frequency': 'Monthly', 'dueDate': '2024-02-10', 'status': 'Draft', 'period': 'January 2024'},
    {'name': 'Quarterly Capital Adequacy', 'frequency': 'Quarterly', 'dueDate': '2024-01-31', 'status': 'In Review', 'period': 'Q4 2023'},
    {'name': 'Annual Financial Statements', 'frequency': 'Annual', 'dueDate': '2024-03-31', 'status': 'Pending', 'period': '2023'},
    {'name': 'eFASS Returns', 'frequency': 'Monthly', 'dueDate': '2024-02-15', 'status': 'Draft', 'period': 'January 2024'},
    {'name': 'Credit Risk Returns', 'frequency': 'Quarterly', 'dueDate': '2024-01-31', 'status': 'Submitted', 'period': 'Q4 2023'},
    {'name': 'Foreign Exchange Returns', 'frequency': 'Weekly', 'dueDate': '2024-01-19', 'status': 'Submitted', 'period': 'Week 2'},
    {'name': 'NDIC Premium Returns', 'frequency': 'Semi-Annual', 'dueDate': '2024-06-30', 'status': 'Pending', 'period': 'H1 2024'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('CBN Regulatory Returns'), backgroundColor: Colors.green[900]),
      body: ListView.builder(itemCount: _returns.length, itemBuilder: (ctx, i) {
        final r = _returns[i];
        final color = r['status'] == 'Submitted' ? Colors.green : r['status'] == 'In Review' ? Colors.blue : r['status'] == 'Draft' ? Colors.orange : Colors.grey;
        return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ListTile(
          leading: CircleAvatar(backgroundColor: color.withOpacity(0.1), child: Icon(Icons.description, color: color)),
          title: Text(r['name'] as String), subtitle: Text('${r["frequency"]} | Period: ${r["period"]} | Due: ${r["dueDate"]}'),
          trailing: Chip(label: Text(r['status'] as String, style: TextStyle(color: color, fontSize: 11)), backgroundColor: color.withOpacity(0.1)),
        ));
      }),
    );
  }
}
