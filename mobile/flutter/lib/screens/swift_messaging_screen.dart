import 'package:flutter/material.dart';

class SwiftMessagingScreen extends StatefulWidget {
  const SwiftMessagingScreen({super.key});
  @override
  State<SwiftMessagingScreen> createState() => _SwiftMessagingScreenState();
}

class _SwiftMessagingScreenState extends State<SwiftMessagingScreen> {
  final List<Map<String, dynamic>> _messages = [
    {'type': 'MT103', 'ref': 'SWIFT-2024-001', 'direction': 'outbound', 'amount': 25000000, 'currency': 'USD', 'counterparty': 'JP Morgan Chase', 'bic': 'CHASUS33', 'status': 'delivered', 'time': '14:32'},
    {'type': 'MT202', 'ref': 'SWIFT-2024-002', 'direction': 'inbound', 'amount': 18000000, 'currency': 'GBP', 'counterparty': 'HSBC London', 'bic': 'MIDLGB22', 'status': 'received', 'time': '13:45'},
    {'type': 'MT940', 'ref': 'SWIFT-2024-003', 'direction': 'inbound', 'amount': 0, 'currency': 'USD', 'counterparty': 'Citibank NY', 'bic': 'CITIUS33', 'status': 'received', 'time': '12:00'},
    {'type': 'MT103', 'ref': 'SWIFT-2024-004', 'direction': 'outbound', 'amount': 45000000, 'currency': 'EUR', 'counterparty': 'Deutsche Bank', 'bic': 'DEUTDEFF', 'status': 'pending_compliance', 'time': '11:20'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('SWIFT Messages')),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _messages.length,
        itemBuilder: (ctx, i) {
          final m = _messages[i];
          bool isOut = m['direction'] == 'outbound';
          return Card(child: ListTile(
            leading: CircleAvatar(
              backgroundColor: isOut ? Colors.red.shade100 : Colors.green.shade100,
              child: Icon(isOut ? Icons.arrow_upward : Icons.arrow_downward, color: isOut ? Colors.red : Colors.green)),
            title: Text('${m["type"]} — ${m["counterparty"]}'),
            subtitle: Text('${m["bic"]} | ${m["currency"]} ${m["amount"] > 0 ? (m["amount"] / 100).toStringAsFixed(0) : "Statement"} | ${m["time"]}'),
            trailing: Chip(label: Text(m['status'].replaceAll('_', ' '), style: const TextStyle(fontSize: 9)),
              backgroundColor: m['status'] == 'delivered' || m['status'] == 'received' ? Colors.green.shade100 : Colors.orange.shade100),
          ));
        },
      ),
    );
  }
}
