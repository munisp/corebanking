import 'package:flutter/material.dart';

class CustomerCardsScreen extends StatefulWidget {
  const CustomerCardsScreen({super.key});
  @override
  State<CustomerCardsScreen> createState() => _CustomerCardsScreenState();
}

class _CustomerCardsScreenState extends State<CustomerCardsScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'card': '**** 4521', 'type': 'Debit - Verve', 'customer': 'Adebayo M.', 'limit': '₦500K/day', 'status': 'Active', },
    {'card': '**** 7832', 'type': 'Credit - Mastercard', 'customer': 'Chukwu E.', 'limit': '₦2M', 'status': 'Active', },
    {'card': '**** 9145', 'type': 'Prepaid - Visa', 'customer': 'Ibrahim K.', 'limit': '₦200K', 'status': 'Blocked', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Customer Cards'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['card'].toString().substring(0, 1)),
                      ),
                      title: Text(item['card'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Type: ${item["type"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Limit: ${item["limit"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
