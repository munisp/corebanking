import 'package:flutter/material.dart';

class DisputeManagementScreen extends StatefulWidget {
  const DisputeManagementScreen({super.key});
  @override
  State<DisputeManagementScreen> createState() => _DisputeManagementScreenState();
}

class _DisputeManagementScreenState extends State<DisputeManagementScreen> {
  final List<Map<String, dynamic>> _disputes = [
    {'id': 'DSP-2024-001', 'type': 'Unauthorized transaction', 'amount': 450000, 'status': 'investigating', 'filed': '2024-01-25', 'sla_days': 3, 'sla_max': 5},
    {'id': 'DSP-2024-002', 'type': 'Failed ATM withdrawal', 'amount': 200000, 'status': 'resolved_credit', 'filed': '2024-01-20', 'sla_days': 5, 'sla_max': 5},
    {'id': 'DSP-2024-003', 'type': 'Wrong amount debited', 'amount': 35000, 'status': 'pending_merchant', 'filed': '2024-01-22', 'sla_days': 6, 'sla_max': 10},
    {'id': 'DSP-2024-004', 'type': 'Double debit', 'amount': 150000, 'status': 'investigating', 'filed': '2024-01-27', 'sla_days': 1, 'sla_max': 5},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Disputes')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {}, icon: const Icon(Icons.add), label: const Text('New Dispute')),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _disputes.length,
        itemBuilder: (ctx, i) {
          final d = _disputes[i];
          double slaProgress = d['sla_days'] / d['sla_max'];
          Color slaColor = slaProgress > 0.8 ? Colors.red : slaProgress > 0.5 ? Colors.orange : Colors.green;
          return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Text(d['id'], style: const TextStyle(fontWeight: FontWeight.bold)),
                const Spacer(),
                Text('\u20A6${(d["amount"] / 100).toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w500)),
              ]),
              const SizedBox(height: 4),
              Text(d['type']),
              const SizedBox(height: 8),
              Row(children: [
                Chip(label: Text(d['status'].replaceAll('_', ' '), style: const TextStyle(fontSize: 10))),
                const Spacer(),
                Text('SLA: ${d["sla_days"]}/${d["sla_max"]}d', style: TextStyle(color: slaColor, fontWeight: FontWeight.w500)),
              ]),
              LinearProgressIndicator(value: slaProgress, backgroundColor: Colors.grey.shade200, color: slaColor),
            ],
          )));
        },
      ),
    );
  }
}
