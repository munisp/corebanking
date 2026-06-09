import 'package:flutter/material.dart';

class AgriReinsuranceScreen extends StatefulWidget {
  const AgriReinsuranceScreen({super.key});
  @override
  State<AgriReinsuranceScreen> createState() => _AgriReinsuranceScreenState();
}

class _AgriReinsuranceScreenState extends State<AgriReinsuranceScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'policy': 'REINSR-001', 'cedant': 'NAIC Pool', 'coverage': '₦5B', 'retention': '20%', 'status': 'Active', },
    {'policy': 'REINSR-002', 'cedant': 'Leadway Agri', 'coverage': '₦2.5B', 'retention': '30%', 'status': 'Active', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Agriculture Reinsurance'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['policy'].toString().substring(0, 1)),
                      ),
                      title: Text(item['policy'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Cedant: ${item["cedant"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Coverage: ${item["coverage"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
