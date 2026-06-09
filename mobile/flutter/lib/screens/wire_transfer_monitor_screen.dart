import 'package:flutter/material.dart';

class WireTransferMonitorScreen extends StatefulWidget {
  const WireTransferMonitorScreen({super.key});
  @override
  State<WireTransferMonitorScreen> createState() => _WireTransferMonitorScreenState();
}

class _WireTransferMonitorScreenState extends State<WireTransferMonitorScreen> {
  final List<Map<String, dynamic>> _transfers = [
    {'ref': 'WT-2024-0045', 'type': 'SWIFT', 'direction': 'Outward', 'amount': 125000, 'currency': 'USD', 'beneficiary': 'ABC Corp London', 'status': 'Completed', 'time': '14:30'},
    {'ref': 'WT-2024-0044', 'type': 'RTGS', 'direction': 'Inward', 'amount': 500000000, 'currency': 'NGN', 'beneficiary': 'FGN Treasury', 'status': 'Completed', 'time': '12:00'},
    {'ref': 'WT-2024-0043', 'type': 'SWIFT', 'direction': 'Outward', 'amount': 85000, 'currency': 'EUR', 'beneficiary': 'Hamburg Trading GmbH', 'status': 'Pending Compliance', 'time': '11:45'},
    {'ref': 'WT-2024-0042', 'type': 'RTGS', 'direction': 'Outward', 'amount': 250000000, 'currency': 'NGN', 'beneficiary': 'CBN Reserve', 'status': 'Completed', 'time': '10:00'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Wire Transfer Monitor')),
      body: ListView.builder(itemCount: _transfers.length, itemBuilder: (ctx, i) {
        final t = _transfers[i];
        final isInward = t['direction'] == 'Inward';
        final statusColor = t['status'] == 'Completed' ? Colors.green : Colors.orange;
        return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ListTile(
          leading: Icon(isInward ? Icons.arrow_downward : Icons.arrow_upward, color: isInward ? Colors.green : Colors.red),
          title: Text('${t["ref"]} (${t["type"]})'),
          subtitle: Text('${t["direction"]} | ${t["currency"]} ${t["amount"]} → ${t["beneficiary"]}\nTime: ${t["time"]}'),
          trailing: Chip(label: Text(t['status'] as String, style: TextStyle(fontSize: 10, color: statusColor)), backgroundColor: statusColor.withOpacity(0.1)),
        ));
      }),
    );
  }
}
