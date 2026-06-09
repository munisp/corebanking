import 'package:flutter/material.dart';

class BankGuaranteesScreen extends StatefulWidget {
  const BankGuaranteesScreen({super.key});
  @override
  State<BankGuaranteesScreen> createState() => _BankGuaranteesScreenState();
}

class _BankGuaranteesScreenState extends State<BankGuaranteesScreen> {
  final List<Map<String, dynamic>> _guarantees = [
    {'ref': 'BG-2024-001', 'type': 'Performance', 'beneficiary': 'Federal Ministry of Works', 'amount': 500000000, 'expiry': '2024-12-31', 'status': 'Active'},
    {'ref': 'BG-2024-002', 'type': 'Bid Bond', 'beneficiary': 'NNPC Ltd', 'amount': 100000000, 'expiry': '2024-06-30', 'status': 'Active'},
    {'ref': 'BG-2024-003', 'type': 'Advance Payment', 'beneficiary': 'Lagos State Govt', 'amount': 250000000, 'expiry': '2024-09-30', 'status': 'Active'},
    {'ref': 'BG-2024-004', 'type': 'Performance', 'beneficiary': 'Julius Berger', 'amount': 1000000000, 'expiry': '2025-06-30', 'status': 'Active'},
    {'ref': 'BG-2023-098', 'type': 'Bid Bond', 'beneficiary': 'FAAN', 'amount': 50000000, 'expiry': '2024-01-10', 'status': 'Expired'},
  ];

  @override
  Widget build(BuildContext context) {
    final totalExposure = _guarantees.where((g) => g['status'] == 'Active').fold<int>(0, (s, g) => s + (g['amount'] as int));
    return Scaffold(
      appBar: AppBar(title: const Text('Bank Guarantees')),
      body: Column(children: [
        Container(padding: const EdgeInsets.all(16), color: Colors.indigo[50], child: Row(children: [
          Expanded(child: _stat('Active', '${_guarantees.where((g) => g["status"] == "Active").length}', Colors.green)),
          Expanded(child: _stat('Total Exposure', '₦${(totalExposure / 1000000000).toStringAsFixed(1)}B', Colors.blue)),
          Expanded(child: _stat('Expiring Soon', '1', Colors.orange)),
        ])),
        Expanded(child: ListView.builder(itemCount: _guarantees.length, itemBuilder: (ctx, i) {
          final g = _guarantees[i];
          return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ListTile(
            leading: const Icon(Icons.security, color: Colors.indigo),
            title: Text('${g["ref"]} - ${g["type"]}'), subtitle: Text('To: ${g["beneficiary"]}\nAmount: ₦${((g["amount"] as int) / 1000000).toStringAsFixed(0)}M | Expiry: ${g["expiry"]}'),
            trailing: Chip(label: Text(g['status'] as String), backgroundColor: g['status'] == 'Active' ? Colors.green[100] : Colors.grey[200]),
          ));
        })),
      ]),
    );
  }

  Widget _stat(String label, String value, Color color) {
    return Column(children: [Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)), Text(label, style: const TextStyle(fontSize: 11))]);
  }
}
