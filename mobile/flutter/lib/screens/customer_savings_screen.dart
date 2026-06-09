import 'package:flutter/material.dart';

class CustomerSavingsScreen extends StatefulWidget {
  const CustomerSavingsScreen({super.key});
  @override
  State<CustomerSavingsScreen> createState() => _CustomerSavingsScreenState();
}

class _CustomerSavingsScreenState extends State<CustomerSavingsScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'product': 'Regular Savings', 'rate': '4.5%', 'min_balance': '₦1,000', 'accounts': '1.8M', 'total': '₦450B', 'status': 'Active', },
    {'product': 'Target Savings', 'rate': '8%', 'min_balance': '₦5,000', 'accounts': '450K', 'total': '₦85B', 'status': 'Active', },
    {'product': 'Fixed Deposit', 'rate': '12%', 'min_balance': '₦100K', 'accounts': '120K', 'total': '₦320B', 'status': 'Active', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Customer Savings'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['product'].toString().substring(0, 1)),
                      ),
                      title: Text(item['product'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Rate: ${item["rate"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Accounts: ${item["accounts"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
