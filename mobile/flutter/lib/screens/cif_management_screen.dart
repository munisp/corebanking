import 'package:flutter/material.dart';

class CifManagementScreen extends StatefulWidget {
  const CifManagementScreen({super.key});
  @override
  State<CifManagementScreen> createState() => _CifManagementScreenState();
}

class _CifManagementScreenState extends State<CifManagementScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'cif': 'CIF-001', 'name': 'Adebayo M.', 'type': 'Individual', 'accounts': 3, 'products': 5, 'status': 'Active', },
    {'cif': 'CIF-002', 'name': 'Chukwu Corp', 'type': 'Corporate', 'accounts': 8, 'products': 12, 'status': 'Active', },
    {'cif': 'CIF-003', 'name': 'Ibrahim K.', 'type': 'Individual', 'accounts': 2, 'products': 3, 'status': 'Dormant', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('CIF Management'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['cif'].toString().substring(0, 1)),
                      ),
                      title: Text(item['cif'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Name: ${item["name"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Type: ${item["type"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
