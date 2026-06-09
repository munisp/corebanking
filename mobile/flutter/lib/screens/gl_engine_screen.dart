import 'package:flutter/material.dart';

class GlEngineScreen extends StatefulWidget {
  const GlEngineScreen({super.key});
  @override
  State<GlEngineScreen> createState() => _GlEngineScreenState();
}

class _GlEngineScreenState extends State<GlEngineScreen> {
  final List<Map<String, dynamic>> _rules = [
    {'name': 'Loan Interest Accrual', 'trigger': 'EOD', 'debit': '1200 - Loans', 'credit': '4000 - Interest Income', 'status': true, 'lastRun': '2024-01-15 02:00'},
    {'name': 'Deposit Interest Accrual', 'trigger': 'EOD', 'debit': '5000 - Interest Expense', 'credit': '2000 - Deposits', 'status': true, 'lastRun': '2024-01-15 02:00'},
    {'name': 'Fee Collection', 'trigger': 'Event', 'debit': '2000 - Customer Account', 'credit': '4100 - Fee Income', 'status': true, 'lastRun': '2024-01-15 14:30'},
    {'name': 'Loan Provisioning', 'trigger': 'Monthly', 'debit': '5200 - Impairment Charge', 'credit': '1250 - Provision for Losses', 'status': true, 'lastRun': '2024-01-01 03:00'},
    {'name': 'FX Revaluation', 'trigger': 'EOD', 'debit': 'Various', 'credit': '4200 - FX Gain/Loss', 'status': false, 'lastRun': '2024-01-14 02:00'},
    {'name': 'Tax Provision', 'trigger': 'Monthly', 'debit': '5300 - Tax Expense', 'credit': '2200 - Tax Payable', 'status': true, 'lastRun': '2024-01-01 03:00'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('GL Engine'), actions: [
        IconButton(icon: const Icon(Icons.play_arrow), onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Manual GL run triggered')));
        }, tooltip: 'Run Now'),
      ]),
      body: Column(children: [
        Container(padding: const EdgeInsets.all(16), color: Colors.indigo[50], child: Row(children: [
          Expanded(child: _statCard('Total Rules', '${_rules.length}', Colors.blue)),
          Expanded(child: _statCard('Active', '${_rules.where((r) => r["status"] == true).length}', Colors.green)),
          Expanded(child: _statCard('Last EOD', '02:00 WAT', Colors.orange)),
          Expanded(child: _statCard('Status', 'Balanced', Colors.green)),
        ])),
        Expanded(child: ListView.builder(itemCount: _rules.length, itemBuilder: (ctx, i) {
          final r = _rules[i];
          return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2), child: SwitchListTile(
            secondary: Icon(r['trigger'] == 'EOD' ? Icons.nightlight : r['trigger'] == 'Event' ? Icons.bolt : Icons.calendar_month,
              color: (r['status'] as bool) ? Colors.indigo : Colors.grey),
            title: Text(r['name'] as String), subtitle: Text('${r["trigger"]} | DR: ${r["debit"]} → CR: ${r["credit"]}\nLast: ${r["lastRun"]}'),
            value: r['status'] as bool, onChanged: (v) => setState(() => r['status'] = v),
          ));
        })),
      ]),
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Column(children: [
      Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
      Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
    ]);
  }
}
