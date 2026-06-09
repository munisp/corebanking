import 'package:flutter/material.dart';

class VirtualAccountsScreen extends StatefulWidget {
  const VirtualAccountsScreen({super.key});
  @override
  State<VirtualAccountsScreen> createState() => _VirtualAccountsScreenState();
}

class _VirtualAccountsScreenState extends State<VirtualAccountsScreen> {
  final List<Map<String, dynamic>> _virtualAccounts = [
    {'number': 'VA-9900001234', 'name': 'Invoice #INV-2024-001', 'merchant': 'ABC Trading Ltd', 'balance': 450000, 'status': 'Active', 'expires': '2024-03-15'},
    {'number': 'VA-9900001235', 'name': 'School Fees - 2024', 'merchant': 'Unilag', 'balance': 0, 'status': 'Active', 'expires': '2024-06-30'},
    {'number': 'VA-9900001236', 'name': 'Rent Collection - Jan', 'merchant': 'Property Mgt Co', 'balance': 2500000, 'status': 'Active', 'expires': '2024-01-31'},
    {'number': 'VA-9900001237', 'name': 'Event Tickets - Concert', 'merchant': 'Entertainment NG', 'balance': 180000, 'status': 'Closed', 'expires': '2024-01-10'},
    {'number': 'VA-9900001238', 'name': 'Donation Campaign', 'merchant': 'NGO Foundation', 'balance': 3450000, 'status': 'Active', 'expires': '2024-12-31'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Virtual Accounts'), actions: [
        IconButton(icon: const Icon(Icons.add), onPressed: _showCreateDialog, tooltip: 'Create Virtual Account'),
      ]),
      body: Column(children: [
        Container(padding: const EdgeInsets.all(16), color: Colors.blue[50], child: Row(children: [
          Expanded(child: _statCard('Total VAs', '${_virtualAccounts.length}', Colors.blue)),
          Expanded(child: _statCard('Active', '${_virtualAccounts.where((a) => a["status"] == "Active").length}', Colors.green)),
          Expanded(child: _statCard('Total Balance', '₦${(_virtualAccounts.fold<int>(0, (s, a) => s + (a["balance"] as int)) / 100).toStringAsFixed(0)}', Colors.purple)),
        ])),
        Expanded(child: ListView.builder(itemCount: _virtualAccounts.length, itemBuilder: (ctx, i) {
          final va = _virtualAccounts[i];
          return Card(margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4), child: ListTile(
            leading: CircleAvatar(backgroundColor: va['status'] == 'Active' ? Colors.green[100] : Colors.grey[200],
              child: Icon(Icons.account_balance, color: va['status'] == 'Active' ? Colors.green : Colors.grey)),
            title: Text(va['name'] as String), subtitle: Text('${va["number"]} | ${va["merchant"]} | Expires: ${va["expires"]}'),
            trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('₦${((va["balance"] as int) / 100).toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold)),
              Chip(label: Text(va['status'] as String, style: const TextStyle(fontSize: 10)),
                backgroundColor: va['status'] == 'Active' ? Colors.green[100] : Colors.grey[200]),
            ]),
          ));
        })),
      ]),
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Column(children: [
      Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
      Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
    ]);
  }

  void _showCreateDialog() {
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Create Virtual Account'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(decoration: const InputDecoration(labelText: 'Account Name', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        TextField(decoration: const InputDecoration(labelText: 'Merchant/Purpose', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        TextField(decoration: const InputDecoration(labelText: 'Expiry Date', border: OutlineInputBorder()), keyboardType: TextInputType.datetime),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        ElevatedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Create')),
      ],
    ));
  }
}
