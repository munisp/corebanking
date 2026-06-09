import 'package:flutter/material.dart';

class ApiMarketplaceScreen extends StatefulWidget {
  const ApiMarketplaceScreen({super.key});
  @override
  State<ApiMarketplaceScreen> createState() => _ApiMarketplaceScreenState();
}

class _ApiMarketplaceScreenState extends State<ApiMarketplaceScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'api': 'Account Balance', 'category': 'Core Banking', 'version': 'v2.1', 'calls': '2.4M/day', 'status': 'Live', },
    {'api': 'Fund Transfer', 'category': 'Payments', 'version': 'v3.0', 'calls': '1.8M/day', 'status': 'Live', },
    {'api': 'KYC Verification', 'category': 'Compliance', 'version': 'v1.5', 'calls': '500K/day', 'status': 'Live', },
    {'api': 'Card Tokenization', 'category': 'Cards', 'version': 'v2.0', 'calls': '300K/day', 'status': 'Beta', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('API Marketplace'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['api'].toString().substring(0, 1)),
                      ),
                      title: Text(item['api'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Category: ${item["category"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Version: ${item["version"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['status'] == 'Live' ? Colors.green[100] : Colors.orange[100],
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
