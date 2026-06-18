import 'package:flutter/material.dart';

class BatchEodScreen extends StatefulWidget {
  const BatchEodScreen({super.key});
  @override
  State<BatchEodScreen> createState() => _BatchEodScreenState();
}

class _BatchEodScreenState extends State<BatchEodScreen> {
  final List<Map<String, dynamic>> _jobs = [
    {'name': 'Interest Accrual', 'status': 'completed', 'duration': '4m 23s', 'records': 2400000},
    {'name': 'Loan Repayment Processing', 'status': 'completed', 'duration': '2m 15s', 'records': 45000},
    {'name': 'Fee Collection', 'status': 'running', 'duration': '1m 45s', 'records': 890000},
    {'name': 'GL Balancing', 'status': 'pending', 'duration': '-', 'records': 0},
    {'name': 'Regulatory Returns', 'status': 'pending', 'duration': '-', 'records': 0},
    {'name': 'Statement Generation', 'status': 'pending', 'duration': '-', 'records': 0},
    {'name': 'Dormancy Check', 'status': 'pending', 'duration': '-', 'records': 0},
  ];

  @override
  Widget build(BuildContext context) {
    int completed = _jobs.where((j) => j['status'] == 'completed').length;
    return Scaffold(
      appBar: AppBar(title: const Text('End of Day Batch'), actions: [
        IconButton(icon: const Icon(Icons.play_arrow), onPressed: () {}),
      ]),
      body: Column(children: [
        Padding(padding: const EdgeInsets.all(16), child: Column(children: [
          Text('EOD Progress: $completed/${_jobs.length}', style: const TextStyle(fontSize: 16)),
          const SizedBox(height: 8),
          LinearProgressIndicator(value: completed / _jobs.length),
        ])),
        Expanded(child: ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: _jobs.length,
          itemBuilder: (ctx, i) {
            final j = _jobs[i];
            IconData icon = j['status'] == 'completed' ? Icons.check_circle
              : j['status'] == 'running' ? Icons.sync : Icons.radio_button_unchecked;
            Color color = j['status'] == 'completed' ? Colors.green
              : j['status'] == 'running' ? Colors.blue : Colors.grey;
            return ListTile(
              leading: Icon(icon, color: color),
              title: Text(j['name']),
              subtitle: j['records'] > 0 ? Text('${j["records"]} records | ${j["duration"]}') : null,
              trailing: j['status'] == 'running' ? const SizedBox(width: 16, height: 16,
                child: CircularProgressIndicator(strokeWidth: 2)) : null,
            );
          },
        )),
      ]),
    );
  }
}
