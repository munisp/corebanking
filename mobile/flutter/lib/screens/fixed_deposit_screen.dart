import 'package:flutter/material.dart';

/// Fixed Deposit — Create, manage, and track fixed deposits with Nigerian bank rates
class FixedDepositScreen extends StatefulWidget {
  const FixedDepositScreen({super.key});
  @override
  State<FixedDepositScreen> createState() => _FixedDepositScreenState();
}

class _FixedDepositScreenState extends State<FixedDepositScreen> {
  final _amountController = TextEditingController();
  int _tenorMonths = 3;
  double _rate = 14.5;
  bool _autoRollover = false;
  int? _maturityAmount;

  final _tenors = [
    {'months': 1, 'rate': 10.0, 'label': '30 days'},
    {'months': 3, 'rate': 14.5, 'label': '90 days'},
    {'months': 6, 'rate': 16.0, 'label': '180 days'},
    {'months': 12, 'rate': 18.5, 'label': '365 days'},
  ];

  final _deposits = [
    {'id': 'FD-001', 'amount': 5000000, 'rate': 16.0, 'tenor': '180 days', 'maturity': '2026-12-09', 'status': 'active'},
    {'id': 'FD-002', 'amount': 2000000, 'rate': 14.5, 'tenor': '90 days', 'maturity': '2026-09-09', 'status': 'active'},
    {'id': 'FD-003', 'amount': 10000000, 'rate': 18.5, 'tenor': '365 days', 'maturity': '2027-06-09', 'status': 'active'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Fixed Deposits')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        // Summary
        Card(color: Colors.indigo.shade50, child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
          const Text('Total Deposits', style: TextStyle(color: Colors.grey)),
          const Text('\u20A617,000,000', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          const Text('Avg Rate: 16.3% p.a.', style: TextStyle(color: Colors.green)),
        ]))),
        const SizedBox(height: 16),
        // Active deposits
        const Text('Active Deposits', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        ..._deposits.map((d) => Card(child: ListTile(
          title: Text('\u20A6${_fmt(d["amount"] as int)}'),
          subtitle: Text('${d["rate"]}% • ${d["tenor"]} • Matures: ${d["maturity"]}'),
          trailing: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8)),
            child: const Text('Active', style: TextStyle(color: Colors.green, fontSize: 11))),
        ))),
        const SizedBox(height: 24),
        // New deposit
        const Text('Create New Deposit', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 12),
        TextField(controller: _amountController, keyboardType: TextInputType.number,
          decoration: InputDecoration(labelText: 'Amount (\u20A6)', prefixText: '\u20A6 ', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            helperText: 'Minimum: \u20A6100,000'),
          onChanged: (_) => _calculateMaturity()),
        const SizedBox(height: 12),
        // Tenor selection
        const Text('Tenor', style: TextStyle(fontWeight: FontWeight.w500)),
        Wrap(spacing: 8, runSpacing: 8, children: _tenors.map((t) => ChoiceChip(
          label: Text('${t["label"]} (${t["rate"]}%)'),
          selected: _tenorMonths == t['months'],
          onSelected: (_) => setState(() { _tenorMonths = t['months'] as int; _rate = t['rate'] as double; _calculateMaturity(); }),
        )).toList()),
        const SizedBox(height: 12),
        SwitchListTile(title: const Text('Auto-rollover at maturity'), value: _autoRollover,
          onChanged: (v) => setState(() => _autoRollover = v)),
        if (_maturityAmount != null) Card(color: Colors.green.shade50, child: Padding(
          padding: const EdgeInsets.all(16), child: Column(children: [
            Text('Maturity Value: \u20A6${_fmt(_maturityAmount!)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.green)),
            Text('Interest: \u20A6${_fmt(_maturityAmount! - (int.tryParse(_amountController.text) ?? 0))}'),
          ]))),
        const SizedBox(height: 16),
        ElevatedButton(onPressed: _amountController.text.isNotEmpty ? () {} : null, child: const Text('Create Fixed Deposit')),
      ]),
    );
  }

  void _calculateMaturity() {
    final principal = int.tryParse(_amountController.text) ?? 0;
    if (principal > 0) {
      final interest = (principal * _rate * _tenorMonths) ~/ (100 * 12);
      setState(() => _maturityAmount = principal + interest);
    }
  }

  String _fmt(int v) => v.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
}
