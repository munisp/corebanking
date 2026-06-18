import 'package:flutter/material.dart';

class AdverseMediaScreen extends StatefulWidget {
  const AdverseMediaScreen({super.key});
  @override
  State<AdverseMediaScreen> createState() => _AdverseMediaScreenState();
}

class _AdverseMediaScreenState extends State<AdverseMediaScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'entity': 'XYZ Corp', 'hits': 3, 'risk': 'High', 'action': 'Review', },
    {'entity': 'ABC Ltd', 'hits': 1, 'risk': 'Low', 'action': 'Auto-cleared', },
    {'entity': 'DEF Industries', 'hits': 7, 'risk': 'Critical', 'action': 'Escalated', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Adverse Media Monitoring'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['entity'].toString().substring(0, 1)),
                      ),
                      title: Text(item['entity'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Hits: ${item["hits"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['risk'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['risk'] == 'Low' ? Colors.green[100] : Colors.orange[100],
                    ),
                    Text('Action: ${item["action"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
