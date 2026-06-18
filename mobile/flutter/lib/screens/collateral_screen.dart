import 'package:flutter/material.dart';

class CollateralScreen extends StatefulWidget {
  const CollateralScreen({super.key});
  @override
  State<CollateralScreen> createState() => _CollateralScreenState();
}

class _CollateralScreenState extends State<CollateralScreen> {
  final List<Map<String, dynamic>> _collaterals = [
    {'id': 'COL-001', 'type': 'Real Estate', 'description': '4-bedroom duplex, Lekki Phase 1', 'value': 85000000, 'loan': 'LN-2024-001', 'coverage': 1.42, 'status': 'Perfected'},
    {'id': 'COL-002', 'type': 'Vehicle', 'description': '2023 Toyota Land Cruiser', 'value': 45000000, 'loan': 'LN-2024-003', 'coverage': 1.5, 'status': 'Perfected'},
    {'id': 'COL-003', 'type': 'Cash', 'description': 'Fixed Deposit Lien', 'value': 10000000, 'loan': 'LN-2024-005', 'coverage': 2.0, 'status': 'Active'},
    {'id': 'COL-004', 'type': 'Equipment', 'description': 'Industrial machinery - Alaba Market', 'value': 25000000, 'loan': 'LN-2024-007', 'coverage': 1.25, 'status': 'Pending Valuation'},
    {'id': 'COL-005', 'type': 'Stock', 'description': 'Quoted shares - Dangote, BUA', 'value': 15000000, 'loan': 'LN-2024-009', 'coverage': 1.8, 'status': 'Active'},
    {'id': 'COL-006', 'type': 'Guarantee', 'description': 'NIRSAL Credit Guarantee', 'value': 5000000, 'loan': 'LN-2024-011', 'coverage': 1.0, 'status': 'Active'},
  ];

  @override
  Widget build(BuildContext context) {
    final totalValue = _collaterals.fold<int>(0, (s, c) => s + (c['value'] as int));
    return Scaffold(
      appBar: AppBar(title: const Text('Collateral Management'), actions: [
        IconButton(icon: const Icon(Icons.add), onPressed: () {}, tooltip: 'Register Collateral'),
      ]),
      body: Column(children: [
        Container(padding: const EdgeInsets.all(16), color: Colors.brown[50], child: Row(children: [
          Expanded(child: _stat('Total Collaterals', '${_collaterals.length}', Colors.brown)),
          Expanded(child: _stat('Total Value', '₦${(totalValue / 1000000).toStringAsFixed(0)}M', Colors.green)),
          Expanded(child: _stat('Avg Coverage', '${(_collaterals.fold<double>(0, (s, c) => s + (c["coverage"] as double)) / _collaterals.length).toStringAsFixed(2)}x', Colors.blue)),
        ])),
        Expanded(child: ListView.builder(itemCount: _collaterals.length, itemBuilder: (ctx, i) {
          final c = _collaterals[i];
          final coverageColor = (c['coverage'] as double) >= 1.5 ? Colors.green : (c['coverage'] as double) >= 1.0 ? Colors.orange : Colors.red;
          return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ListTile(
            leading: Icon(_typeIcon(c['type'] as String), color: Colors.brown),
            title: Text('${c["type"]} - ${c["id"]}'), subtitle: Text('${c["description"]}\nLinked: ${c["loan"]}'),
            trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('₦${((c["value"] as int) / 1000000).toStringAsFixed(0)}M', style: const TextStyle(fontWeight: FontWeight.bold)),
              Text('${c["coverage"]}x', style: TextStyle(color: coverageColor, fontWeight: FontWeight.bold)),
              Text(c['status'] as String, style: const TextStyle(fontSize: 10)),
            ]),
          ));
        })),
      ]),
    );
  }

  IconData _typeIcon(String type) {
    switch (type) {
      case 'Real Estate': return Icons.home;
      case 'Vehicle': return Icons.directions_car;
      case 'Cash': return Icons.monetization_on;
      case 'Equipment': return Icons.precision_manufacturing;
      case 'Stock': return Icons.trending_up;
      case 'Guarantee': return Icons.security;
      default: return Icons.inventory;
    }
  }

  Widget _stat(String label, String value, Color color) {
    return Column(children: [Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)), Text(label, style: const TextStyle(fontSize: 11))]);
  }
}
