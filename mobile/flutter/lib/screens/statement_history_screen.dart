import 'package:flutter/material.dart';

class StatementHistoryScreen extends StatefulWidget {
  const StatementHistoryScreen({super.key});
  @override
  State<StatementHistoryScreen> createState() => _StatementHistoryScreenState();
}

class _StatementHistoryScreenState extends State<StatementHistoryScreen> {
  final List<Map<String, dynamic>> _statements = [
    {'period': 'Jan 2024', 'account': 'Savings - 5678', 'format': 'PDF', 'size': '245 KB', 'generated': '2024-01-31'},
    {'period': 'Dec 2023', 'account': 'Savings - 5678', 'format': 'PDF', 'size': '312 KB', 'generated': '2023-12-31'},
    {'period': 'Nov 2023', 'account': 'Current - 6789', 'format': 'CSV', 'size': '89 KB', 'generated': '2023-11-30'},
    {'period': 'Oct 2023', 'account': 'Savings - 5678', 'format': 'PDF', 'size': '198 KB', 'generated': '2023-10-31'},
    {'period': 'Q3 2023', 'account': 'Savings - 5678', 'format': 'Excel', 'size': '456 KB', 'generated': '2023-10-01'},
    {'period': 'Sep 2023', 'account': 'Domiciliary - USD', 'format': 'PDF', 'size': '67 KB', 'generated': '2023-09-30'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Statement History')),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _statements.length,
        itemBuilder: (ctx, i) {
          final s = _statements[i];
          IconData icon = s['format'] == 'PDF' ? Icons.picture_as_pdf
            : s['format'] == 'CSV' ? Icons.table_chart : Icons.grid_on;
          Color color = s['format'] == 'PDF' ? Colors.red : s['format'] == 'CSV' ? Colors.green : Colors.blue;
          return Card(child: ListTile(
            leading: CircleAvatar(backgroundColor: color.withOpacity(0.1), child: Icon(icon, color: color)),
            title: Text('${s["period"]} — ${s["account"]}'),
            subtitle: Text('${s["format"]} • ${s["size"]} • ${s["generated"]}'),
            trailing: IconButton(icon: const Icon(Icons.download), onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Downloading ${s["period"]} statement...')));
            }),
          ));
        },
      ),
    );
  }
}
