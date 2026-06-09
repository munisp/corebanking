import 'package:flutter/material.dart';

class TradeFinanceScreen extends StatefulWidget {
  const TradeFinanceScreen({super.key});
  @override
  State<TradeFinanceScreen> createState() => _TradeFinanceScreenState();
}

class _TradeFinanceScreenState extends State<TradeFinanceScreen> {
  final List<Map<String, dynamic>> _transactions = [
    {'type': 'Letter of Credit', 'ref': 'LC-2024-001', 'amount': 500000000, 'currency': 'USD', 'counterparty': 'China Import Co.', 'status': 'active', 'expiry': '2024-06-30'},
    {'type': 'Bank Guarantee', 'ref': 'BG-2024-003', 'amount': 200000000, 'currency': 'NGN', 'counterparty': 'Federal Roads Authority', 'status': 'active', 'expiry': '2025-01-15'},
    {'type': 'Documentary Collection', 'ref': 'DC-2024-007', 'amount': 150000000, 'currency': 'EUR', 'counterparty': 'German Machinery GmbH', 'status': 'pending_docs', 'expiry': '2024-03-20'},
    {'type': 'Invoice Discounting', 'ref': 'ID-2024-015', 'amount': 80000000, 'currency': 'NGN', 'counterparty': 'NNPC', 'status': 'disbursed', 'expiry': '2024-02-28'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Trade Finance')),
      floatingActionButton: FloatingActionButton(onPressed: () {}, child: const Icon(Icons.add)),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _transactions.length,
        itemBuilder: (ctx, i) {
          final t = _transactions[i];
          return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Chip(label: Text(t['type'], style: const TextStyle(fontSize: 11))),
                const Spacer(),
                Text(t['ref'], style: const TextStyle(fontWeight: FontWeight.bold)),
              ]),
              const SizedBox(height: 8),
              Text(t['counterparty'], style: const TextStyle(fontSize: 15)),
              const SizedBox(height: 4),
              Row(children: [
                Text('${t["currency"]} ${(t["amount"] / 100).toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w500)),
                const Spacer(),
                Chip(label: Text(t['status'].replaceAll('_', ' '), style: const TextStyle(fontSize: 10)),
                  backgroundColor: t['status'] == 'active' ? Colors.green.shade100 : Colors.orange.shade100),
              ]),
              Text('Expires: ${t["expiry"]}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
            ],
          )));
        },
      ),
    );
  }
}
