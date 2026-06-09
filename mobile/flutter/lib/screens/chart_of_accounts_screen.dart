import 'package:flutter/material.dart';

class ChartOfAccountsScreen extends StatefulWidget {
  const ChartOfAccountsScreen({super.key});
  @override
  State<ChartOfAccountsScreen> createState() => _ChartOfAccountsScreenState();
}

class _ChartOfAccountsScreenState extends State<ChartOfAccountsScreen> {
  String _filter = 'All';
  final List<Map<String, dynamic>> _accounts = [
    {'code': '1000', 'name': 'Cash and Balances with CBN', 'type': 'Asset', 'balance': 45000000000, 'children': 12, 'status': 'Active'},
    {'code': '1100', 'name': 'Balances with Other Banks', 'type': 'Asset', 'balance': 23000000000, 'children': 8, 'status': 'Active'},
    {'code': '1200', 'name': 'Loans and Advances', 'type': 'Asset', 'balance': 180000000000, 'children': 25, 'status': 'Active'},
    {'code': '1300', 'name': 'Investment Securities', 'type': 'Asset', 'balance': 95000000000, 'children': 15, 'status': 'Active'},
    {'code': '2000', 'name': 'Customer Deposits', 'type': 'Liability', 'balance': 240000000000, 'children': 18, 'status': 'Active'},
    {'code': '2100', 'name': 'Borrowings', 'type': 'Liability', 'balance': 35000000000, 'children': 6, 'status': 'Active'},
    {'code': '3000', 'name': 'Share Capital', 'type': 'Equity', 'balance': 15000000000, 'children': 4, 'status': 'Active'},
    {'code': '3100', 'name': 'Retained Earnings', 'type': 'Equity', 'balance': 28000000000, 'children': 3, 'status': 'Active'},
    {'code': '4000', 'name': 'Interest Income', 'type': 'Revenue', 'balance': 8900000000, 'children': 10, 'status': 'Active'},
    {'code': '4100', 'name': 'Fee and Commission Income', 'type': 'Revenue', 'balance': 4500000000, 'children': 12, 'status': 'Active'},
    {'code': '5000', 'name': 'Interest Expense', 'type': 'Expense', 'balance': 3400000000, 'children': 8, 'status': 'Active'},
    {'code': '5100', 'name': 'Operating Expenses', 'type': 'Expense', 'balance': 6700000000, 'children': 20, 'status': 'Active'},
  ];

  Color _typeColor(String type) {
    switch (type) {
      case 'Asset': return Colors.blue;
      case 'Liability': return Colors.red;
      case 'Equity': return Colors.purple;
      case 'Revenue': return Colors.green;
      case 'Expense': return Colors.orange;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filter == 'All' ? _accounts : _accounts.where((a) => a['type'] == _filter).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Chart of Accounts'), actions: [
        DropdownButton<String>(value: _filter, underline: const SizedBox(),
          items: ['All', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
          onChanged: (v) => setState(() => _filter = v!)),
        IconButton(icon: const Icon(Icons.add), onPressed: () {}, tooltip: 'Add Account'),
      ]),
      body: Column(children: [
        Container(padding: const EdgeInsets.all(12), color: Colors.grey[100], child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
          _summaryChip('Assets', '₦343B', Colors.blue), _summaryChip('Liabilities', '₦275B', Colors.red),
          _summaryChip('Equity', '₦43B', Colors.purple), _summaryChip('Net', '₦25B', Colors.green),
        ])),
        Expanded(child: ListView.builder(itemCount: filtered.length, itemBuilder: (ctx, i) {
          final a = filtered[i];
          return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2), child: ListTile(
            leading: CircleAvatar(backgroundColor: _typeColor(a['type'] as String).withOpacity(0.1),
              child: Text(a['code'] as String, style: TextStyle(fontSize: 10, color: _typeColor(a['type'] as String), fontWeight: FontWeight.bold))),
            title: Text(a['name'] as String), subtitle: Text('${a["type"]} | ${a["children"]} sub-accounts'),
            trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('₦${((a["balance"] as int) / 1000000000).toStringAsFixed(1)}B', style: TextStyle(fontWeight: FontWeight.bold, color: _typeColor(a['type'] as String))),
              const Icon(Icons.chevron_right, size: 16),
            ]),
          ));
        })),
      ]),
    );
  }

  Widget _summaryChip(String label, String value, Color color) {
    return Column(children: [
      Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color)), Text(label, style: const TextStyle(fontSize: 11)),
    ]);
  }
}
