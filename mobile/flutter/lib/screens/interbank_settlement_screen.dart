import 'package:flutter/material.dart';

class InterbankSettlementScreen extends StatefulWidget {
  const InterbankSettlementScreen({super.key});
  @override
  State<InterbankSettlementScreen> createState() => _InterbankSettlementScreenState();
}

class _InterbankSettlementScreenState extends State<InterbankSettlementScreen> {
  final List<Map<String, dynamic>> _settlements = [
    {'id': 'SET-2024-0115-001', 'counterparty': 'First Bank', 'type': 'NIP', 'netAmount': 2340000000, 'direction': 'Receivable', 'status': 'Settled', 'time': '16:00'},
    {'id': 'SET-2024-0115-002', 'counterparty': 'GTBank', 'type': 'NIP', 'netAmount': 1890000000, 'direction': 'Payable', 'status': 'Settled', 'time': '16:00'},
    {'id': 'SET-2024-0115-003', 'counterparty': 'NIBSS', 'type': 'NEFT', 'netAmount': 5670000000, 'direction': 'Receivable', 'status': 'Pending', 'time': '18:00'},
    {'id': 'SET-2024-0115-004', 'counterparty': 'Visa', 'type': 'Card', 'netAmount': 890000000, 'direction': 'Payable', 'status': 'Pending', 'time': '23:00'},
    {'id': 'SET-2024-0115-005', 'counterparty': 'Interswitch', 'type': 'POS', 'netAmount': 3450000000, 'direction': 'Receivable', 'status': 'Settled', 'time': '16:00'},
  ];

  @override
  Widget build(BuildContext context) {
    final totalReceivable = _settlements.where((s) => s['direction'] == 'Receivable').fold<int>(0, (sum, s) => sum + (s['netAmount'] as int));
    final totalPayable = _settlements.where((s) => s['direction'] == 'Payable').fold<int>(0, (sum, s) => sum + (s['netAmount'] as int));
    return Scaffold(
      appBar: AppBar(title: const Text('Interbank Settlement')),
      body: Column(children: [
        Container(padding: const EdgeInsets.all(16), color: Colors.teal[50], child: Column(children: [
          Row(children: [
            Expanded(child: _summaryCard('Receivable', '₦${(totalReceivable / 1000000000).toStringAsFixed(1)}B', Colors.green)),
            Expanded(child: _summaryCard('Payable', '₦${(totalPayable / 1000000000).toStringAsFixed(1)}B', Colors.red)),
            Expanded(child: _summaryCard('Net Position', '₦${((totalReceivable - totalPayable) / 1000000000).toStringAsFixed(1)}B', Colors.blue)),
          ]),
          const SizedBox(height: 8),
          const Text('Settlement Date: January 15, 2024 | CBN Settlement Window: 16:00 WAT', style: TextStyle(fontSize: 12, color: Colors.grey)),
        ])),
        Expanded(child: ListView.builder(itemCount: _settlements.length, itemBuilder: (ctx, i) {
          final s = _settlements[i];
          final isReceivable = s['direction'] == 'Receivable';
          return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2), child: ListTile(
            leading: CircleAvatar(backgroundColor: isReceivable ? Colors.green[50] : Colors.red[50],
              child: Icon(isReceivable ? Icons.arrow_downward : Icons.arrow_upward, color: isReceivable ? Colors.green : Colors.red)),
            title: Text('${s["counterparty"]} (${s["type"]})'), subtitle: Text('${s["id"]} | Window: ${s["time"]}'),
            trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('₦${((s["netAmount"] as int) / 1000000000).toStringAsFixed(2)}B', style: TextStyle(fontWeight: FontWeight.bold, color: isReceivable ? Colors.green : Colors.red)),
              Chip(label: Text(s['status'] as String, style: const TextStyle(fontSize: 10)),
                backgroundColor: s['status'] == 'Settled' ? Colors.green[100] : Colors.orange[100]),
            ]),
          ));
        })),
      ]),
    );
  }

  Widget _summaryCard(String label, String value, Color color) {
    return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [
      Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
      Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
    ])));
  }
}
