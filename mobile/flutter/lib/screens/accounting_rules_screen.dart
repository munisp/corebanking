import 'package:flutter/material.dart';

class AccountingRulesScreen extends StatefulWidget {
  const AccountingRulesScreen({super.key});
  @override
  State<AccountingRulesScreen> createState() => _AccountingRulesScreenState();
}

class _AccountingRulesScreenState extends State<AccountingRulesScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'rule': 'Loan Interest Accrual', 'type': 'Automated', 'freq': 'Daily', 'gl': '4100/2100', 'status': 'Active', },
    {'rule': 'Fee Collection', 'type': 'Event-driven', 'freq': 'On Txn', 'gl': '1100/4200', 'status': 'Active', },
    {'rule': 'Deposit Interest', 'type': 'Automated', 'freq': 'Monthly', 'gl': '5100/2100', 'status': 'Active', },
    {'rule': 'Provision Bad Debts', 'type': 'Automated', 'freq': 'Monthly', 'gl': '5200/1300', 'status': 'Active', },
    {'rule': 'FX Revaluation', 'type': 'Automated', 'freq': 'Daily', 'gl': '6100/1100', 'status': 'Active', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Accounting Rules Engine'), backgroundColor: Colors.green[700]),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              decoration: InputDecoration(
                hintText: 'Search...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onChanged: (v) => setState(() => _searchQuery = v),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: ListView.builder(
                itemCount: _filteredItems.length,
                itemBuilder: (context, index) {
                  final item = _filteredItems[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: Colors.green[100],
                        child: Text(item['rule'].toString().substring(0, 1)),
                      ),
                      title: Text(item['rule'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Type: ${item["type"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Frequency: ${item["freq"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['status'] == 'Active' ? Colors.green[100] : Colors.orange[100],
                    ),
                        ],
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {},
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
