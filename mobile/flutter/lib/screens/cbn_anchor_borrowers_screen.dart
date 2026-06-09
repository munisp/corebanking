import 'package:flutter/material.dart';

class CbnAnchorBorrowersScreen extends StatefulWidget {
  const CbnAnchorBorrowersScreen({super.key});
  @override
  State<CbnAnchorBorrowersScreen> createState() => _CbnAnchorBorrowersScreenState();
}

class _CbnAnchorBorrowersScreenState extends State<CbnAnchorBorrowersScreen> {
  final List<Map<String, dynamic>> _loans = [
    {'id': 'ABP-2024-001', 'farmer': 'Ogun Rice Cooperative', 'crop': 'Rice', 'amount': 25000000, 'rate': 9.0, 'hectares': 50, 'status': 'Disbursed', 'repayment': '2024-10-31'},
    {'id': 'ABP-2024-002', 'farmer': 'Kaduna Maize Cluster', 'crop': 'Maize', 'amount': 18000000, 'rate': 9.0, 'hectares': 40, 'status': 'Disbursed', 'repayment': '2024-09-30'},
    {'id': 'ABP-2024-003', 'farmer': 'Benue Soybean Group', 'crop': 'Soybean', 'amount': 12000000, 'rate': 9.0, 'hectares': 30, 'status': 'Approved', 'repayment': '2024-11-30'},
    {'id': 'ABP-2024-004', 'farmer': 'Kano Groundnut Assoc', 'crop': 'Groundnut', 'amount': 8000000, 'rate': 9.0, 'hectares': 20, 'status': 'Repaid', 'repayment': 'Completed'},
  ];

  @override
  Widget build(BuildContext context) {
    final totalDisbursed = _loans.where((l) => l['status'] == 'Disbursed').fold<int>(0, (s, l) => s + (l['amount'] as int));
    return Scaffold(
      appBar: AppBar(title: const Text('CBN Anchor Borrowers'), backgroundColor: Colors.green[900]),
      body: Column(children: [
        Container(padding: const EdgeInsets.all(16), color: Colors.green[50], child: Column(children: [
          const Text('Anchor Borrowers Programme (ABP)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const Text('CBN Rate: 9% p.a. | Max Tenor: 1 growing season', style: TextStyle(color: Colors.grey)),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _stat('Total Loans', '${_loans.length}', Colors.blue)),
            Expanded(child: _stat('Disbursed', '₦${(totalDisbursed / 1000000).toStringAsFixed(0)}M', Colors.green)),
            Expanded(child: _stat('Total Hectares', '${_loans.fold<int>(0, (s, l) => s + (l["hectares"] as int))}', Colors.orange)),
          ]),
        ])),
        Expanded(child: ListView.builder(itemCount: _loans.length, itemBuilder: (ctx, i) {
          final l = _loans[i];
          final statusColor = l['status'] == 'Disbursed' ? Colors.green : l['status'] == 'Approved' ? Colors.blue : l['status'] == 'Repaid' ? Colors.teal : Colors.grey;
          return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ListTile(
            leading: const Icon(Icons.agriculture, color: Colors.green),
            title: Text('${l["id"]} - ${l["farmer"]}'),
            subtitle: Text('Crop: ${l["crop"]} | ${l["hectares"]} ha | ₦${((l["amount"] as int) / 1000000).toStringAsFixed(0)}M @ ${l["rate"]}%\nRepayment: ${l["repayment"]}'),
            trailing: Chip(label: Text(l['status'] as String), backgroundColor: statusColor.withOpacity(0.1)),
          ));
        })),
      ]),
    );
  }

  Widget _stat(String label, String value, Color color) {
    return Column(children: [Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)), Text(label, style: const TextStyle(fontSize: 11))]);
  }
}
