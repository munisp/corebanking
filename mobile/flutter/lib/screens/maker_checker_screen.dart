import 'package:flutter/material.dart';

class MakerCheckerScreen extends StatefulWidget {
  const MakerCheckerScreen({super.key});
  @override
  State<MakerCheckerScreen> createState() => _MakerCheckerScreenState();
}

class _MakerCheckerScreenState extends State<MakerCheckerScreen> {
  final List<Map<String, dynamic>> _rules = [
    {'action': 'Transfer > \u20A61M', 'makers': 1, 'checkers': 1, 'sla': '30 min', 'active': true},
    {'action': 'Transfer > \u20A610M', 'makers': 1, 'checkers': 2, 'sla': '2 hours', 'active': true},
    {'action': 'Account Closure', 'makers': 1, 'checkers': 2, 'sla': '24 hours', 'active': true},
    {'action': 'Loan Disbursement', 'makers': 1, 'checkers': 2, 'sla': '4 hours', 'active': true},
    {'action': 'Fee Waiver', 'makers': 1, 'checkers': 1, 'sla': '1 hour', 'active': true},
    {'action': 'User Role Change', 'makers': 1, 'checkers': 2, 'sla': '2 hours', 'active': true},
    {'action': 'GL Posting', 'makers': 1, 'checkers': 1, 'sla': '30 min', 'active': false},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Maker-Checker Rules')),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _rules.length,
        itemBuilder: (ctx, i) {
          final r = _rules[i];
          return Card(child: SwitchListTile(
            title: Text(r['action']),
            subtitle: Text('${r["makers"]} maker(s) → ${r["checkers"]} checker(s) | SLA: ${r["sla"]}'),
            value: r['active'],
            onChanged: (v) => setState(() => r['active'] = v),
          ));
        },
      ),
    );
  }
}
