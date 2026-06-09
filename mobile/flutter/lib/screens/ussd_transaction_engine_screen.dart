import 'package:flutter/material.dart';

/// USSD Transaction Engine — Real-time transaction processing and routing dashboard
class UssdTransactionEngineScreen extends StatefulWidget {
  const UssdTransactionEngineScreen({super.key});
  @override
  State<UssdTransactionEngineScreen> createState() => _UssdTransactionEngineScreenState();
}

class _UssdTransactionEngineScreenState extends State<UssdTransactionEngineScreen> {
  final _txnTypes = [
    {'type': 'Transfer', 'count': 12450, 'amount': 8500000000, 'avgTime': '1.2s', 'successRate': 99.7},
    {'type': 'Airtime', 'count': 34200, 'amount': 1200000000, 'avgTime': '0.8s', 'successRate': 99.9},
    {'type': 'Bill Pay', 'count': 8900, 'amount': 3400000000, 'avgTime': '2.1s', 'successRate': 98.5},
    {'type': 'Balance', 'count': 67800, 'amount': 0, 'avgTime': '0.3s', 'successRate': 100.0},
    {'type': 'Statement', 'count': 4500, 'amount': 0, 'avgTime': '0.5s', 'successRate': 99.8},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Transaction Engine')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        // Performance cards
        Row(children: [
          _perfCard('TPS', '4,521', 'Transactions/sec'),
          _perfCard('Latency', '1.1s', 'p95 Response'),
          _perfCard('Success', '99.7%', 'Overall'),
        ].map((w) => Expanded(child: Padding(padding: const EdgeInsets.all(4), child: w))).toList()),
        const SizedBox(height: 16),
        // Transaction breakdown
        const Text('Transaction Types (Today)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        DataTable(
          columnSpacing: 16,
          columns: const [DataColumn(label: Text('Type')), DataColumn(label: Text('Count'), numeric: true),
            DataColumn(label: Text('Avg')), DataColumn(label: Text('Rate'))],
          rows: _txnTypes.map((t) => DataRow(cells: [
            DataCell(Text(t['type'] as String)),
            DataCell(Text('${(t["count"] as int) ~/ 1000}K')),
            DataCell(Text(t['avgTime'] as String)),
            DataCell(Row(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle,
                  color: (t['successRate'] as double) >= 99.5 ? Colors.green : Colors.orange)),
              const SizedBox(width: 4),
              Text('${t["successRate"]}%'),
            ])),
          ])).toList(),
        ),
        const SizedBox(height: 16),
        // Routing rules
        const Text('Routing Rules', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        Card(child: Column(children: [
          _ruleItem('Transfer > ₦5M', 'Requires MFA + Maker-Checker', Colors.red),
          _ruleItem('Transfer > ₦1M', 'Requires MFA (OTP/Biometric)', Colors.orange),
          _ruleItem('Bill Pay', 'Direct debit (no PIN for auto-pay)', Colors.blue),
          _ruleItem('Airtime < ₦5K', 'Fast-path (skip balance check)', Colors.green),
        ])),
      ]),
    );
  }

  Widget _perfCard(String label, String value, String subtitle) => Card(
    child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [
      Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
      Text(subtitle, style: const TextStyle(fontSize: 9, color: Colors.grey)),
    ])),
  );

  Widget _ruleItem(String rule, String action, Color color) => ListTile(
    dense: true,
    leading: Container(width: 4, height: 30, color: color),
    title: Text(rule, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
    subtitle: Text(action, style: const TextStyle(fontSize: 11)),
  );
}
