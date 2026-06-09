import 'package:flutter/material.dart';

class ReconciliationScreen extends StatefulWidget {
  const ReconciliationScreen({super.key});
  @override
  State<ReconciliationScreen> createState() => _ReconciliationScreenState();
}

class _ReconciliationScreenState extends State<ReconciliationScreen> {
  final List<Map<String, dynamic>> _jobs = [
    {'name': 'NIBSS Daily', 'status': 'completed', 'matched': 45230, 'unmatched': 12, 'date': '2024-01-28', 'variance': 156000},
    {'name': 'Interswitch POS', 'status': 'in_progress', 'matched': 12450, 'unmatched': 45, 'date': '2024-01-28', 'variance': 890000},
    {'name': 'Card Scheme (Visa)', 'status': 'pending', 'matched': 0, 'unmatched': 0, 'date': '2024-01-28', 'variance': 0},
    {'name': 'CBN Returns', 'status': 'completed', 'matched': 890, 'unmatched': 0, 'date': '2024-01-27', 'variance': 0},
    {'name': 'Nostro (USD)', 'status': 'completed', 'matched': 234, 'unmatched': 3, 'date': '2024-01-27', 'variance': 45000000},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reconciliation')),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _jobs.length,
        itemBuilder: (ctx, i) {
          final j = _jobs[i];
          Color statusColor = j['status'] == 'completed' ? Colors.green : j['status'] == 'in_progress' ? Colors.blue : Colors.grey;
          return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Text(j['name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                const Spacer(),
                Chip(label: Text(j['status'].replaceAll('_', ' '), style: TextStyle(color: statusColor, fontSize: 10)),
                  backgroundColor: statusColor.withOpacity(0.1)),
              ]),
              const SizedBox(height: 8),
              Row(children: [
                _stat('Matched', '${j["matched"]}', Colors.green),
                const SizedBox(width: 16),
                _stat('Unmatched', '${j["unmatched"]}', j['unmatched'] > 0 ? Colors.red : Colors.green),
                const SizedBox(width: 16),
                if (j['variance'] > 0) _stat('Variance', '\u20A6${(j["variance"] / 100).toStringAsFixed(0)}', Colors.orange),
              ]),
              const SizedBox(height: 4),
              Text(j['date'], style: const TextStyle(color: Colors.grey, fontSize: 12)),
            ],
          )));
        },
      ),
    );
  }

  Widget _stat(String label, String value, Color color) => Column(
    crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
      Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color)),
    ]);
}
