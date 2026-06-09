import 'package:flutter/material.dart';

class CustomerLoansScreen extends StatefulWidget {
  const CustomerLoansScreen({super.key});
  @override
  State<CustomerLoansScreen> createState() => _CustomerLoansScreenState();
}

class _CustomerLoansScreenState extends State<CustomerLoansScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'loan': 'LN-001', 'customer': 'Adebayo M.', 'product': 'Personal Loan', 'amount': '₦5M', 'rate': '18%', 'status': 'Active', },
    {'loan': 'LN-002', 'customer': 'Chukwu Corp', 'product': 'Working Capital', 'amount': '₦50M', 'rate': '22%', 'status': 'Active', },
    {'loan': 'LN-003', 'customer': 'Ibrahim K.', 'product': 'Mortgage', 'amount': '₦25M', 'rate': '12%', 'status': 'Active', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Customer Loans'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['loan'].toString().substring(0, 1)),
                      ),
                      title: Text(item['loan'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Customer: ${item["customer"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Amount: ${item["amount"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
