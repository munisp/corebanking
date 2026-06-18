import 'package:flutter/material.dart';

class NibssDirectDebitScreen extends StatefulWidget {
  const NibssDirectDebitScreen({super.key});
  @override
  State<NibssDirectDebitScreen> createState() => _NibssDirectDebitScreenState();
}

class _NibssDirectDebitScreenState extends State<NibssDirectDebitScreen> {
  final List<Map<String, dynamic>> _mandates = [
    {'ref': 'DDM-2024-001', 'debtor': 'Adebayo Ogunlade', 'amount': 150000, 'frequency': 'Monthly', 'account': '0012345678', 'status': 'Active', 'nextDebit': '2024-02-01'},
    {'ref': 'DDM-2024-002', 'debtor': 'Chidinma Okafor', 'amount': 85000, 'frequency': 'Monthly', 'account': '0023456789', 'status': 'Active', 'nextDebit': '2024-02-01'},
    {'ref': 'DDM-2024-003', 'debtor': 'Emeka Nwankwo', 'amount': 250000, 'frequency': 'Quarterly', 'account': '0034567890', 'status': 'Suspended', 'nextDebit': '-'},
    {'ref': 'DDM-2024-004', 'debtor': 'Fatima Abdullahi', 'amount': 50000, 'frequency': 'Monthly', 'account': '0045678901', 'status': 'Active', 'nextDebit': '2024-02-01'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('NIBSS Direct Debit'), actions: [
        IconButton(icon: const Icon(Icons.add), onPressed: () {}, tooltip: 'New Mandate'),
      ]),
      body: ListView.builder(itemCount: _mandates.length, itemBuilder: (ctx, i) {
        final m = _mandates[i];
        final isActive = m['status'] == 'Active';
        return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ListTile(
          leading: Icon(Icons.receipt_long, color: isActive ? Colors.green : Colors.grey),
          title: Text('${m["ref"]} - ${m["debtor"]}'),
          subtitle: Text('₦${((m["amount"] as int) / 100).toStringAsFixed(0)} | ${m["frequency"]} | Acct: ${m["account"]}\nNext: ${m["nextDebit"]}'),
          trailing: Chip(label: Text(m['status'] as String), backgroundColor: isActive ? Colors.green[100] : Colors.grey[200]),
        ));
      }),
    );
  }
}
