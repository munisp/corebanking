import 'package:flutter/material.dart';

class TreasuryScreen extends StatefulWidget {
  const TreasuryScreen({super.key});
  @override
  State<TreasuryScreen> createState() => _TreasuryScreenState();
}

class _TreasuryScreenState extends State<TreasuryScreen> {
  final Map<String, dynamic> _position = {
    'total_assets': 1250000000000, 'total_liabilities': 980000000000,
    'liquidity_ratio': 35.2, 'cbn_minimum': 30.0,
  };

  final List<Map<String, dynamic>> _instruments = [
    {'type': 'T-Bills (91 days)', 'amount': 150000000000, 'yield': 12.5, 'maturity': '2024-04-15'},
    {'type': 'T-Bills (182 days)', 'amount': 200000000000, 'yield': 14.0, 'maturity': '2024-07-28'},
    {'type': 'FGN Bonds (5yr)', 'amount': 100000000000, 'yield': 16.5, 'maturity': '2029-01-15'},
    {'type': 'OMO Bills', 'amount': 80000000000, 'yield': 18.0, 'maturity': '2024-03-20'},
    {'type': 'Interbank Placement', 'amount': 50000000000, 'yield': 22.0, 'maturity': '2024-02-05'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Treasury Dashboard')),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(
        crossAxisAlignment: CrossAxisAlignment.start, children: [
          Card(color: Colors.indigo.shade50, child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
            Row(children: [
              Expanded(child: Column(children: [
                const Text('Total Assets', style: TextStyle(color: Colors.grey, fontSize: 12)),
                Text('\u20A6${(_position["total_assets"] / 100000000000).toStringAsFixed(1)}T',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              ])),
              Expanded(child: Column(children: [
                const Text('Liquidity Ratio', style: TextStyle(color: Colors.grey, fontSize: 12)),
                Text('${_position["liquidity_ratio"]}%', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold,
                  color: _position['liquidity_ratio'] > _position['cbn_minimum'] ? Colors.green : Colors.red)),
              ])),
            ]),
            const SizedBox(height: 8),
            Text('CBN Minimum: ${_position["cbn_minimum"]}%', style: const TextStyle(color: Colors.grey, fontSize: 12)),
          ]))),
          const SizedBox(height: 16),
          const Text('Investment Portfolio', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ...List.generate(_instruments.length, (i) {
            final inst = _instruments[i];
            return Card(child: ListTile(
              title: Text(inst['type']),
              subtitle: Text('Maturity: ${inst["maturity"]} | Yield: ${inst["yield"]}%'),
              trailing: Text('\u20A6${(inst["amount"] / 100000000000).toStringAsFixed(1)}B',
                style: const TextStyle(fontWeight: FontWeight.bold)),
            ));
          }),
        ],
      )),
    );
  }
}
