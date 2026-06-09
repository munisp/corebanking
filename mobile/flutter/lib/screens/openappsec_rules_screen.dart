import 'package:flutter/material.dart';

class OpenappsecRulesScreen extends StatefulWidget {
  const OpenappsecRulesScreen({super.key});
  @override
  State<OpenappsecRulesScreen> createState() => _OpenappsecRulesScreenState();
}

class _OpenappsecRulesScreenState extends State<OpenappsecRulesScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'name': 'Item 1', 'type': 'Standard', 'value': '₦100K', 'status': 'Active', },
    {'name': 'Item 2', 'type': 'Standard', 'value': '₦200K', 'status': 'Active', },
    {'name': 'Item 3', 'type': 'Standard', 'value': '₦300K', 'status': 'Active', },
    {'name': 'Item 4', 'type': 'Standard', 'value': '₦400K', 'status': 'Pending', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Openappsec Rules'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['name'].toString().substring(0, 1)),
                      ),
                      title: Text(item['name'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Type: ${item["type"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Value: ${item["value"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
