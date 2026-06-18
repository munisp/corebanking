import 'package:flutter/material.dart';

class CacVerificationScreen extends StatefulWidget {
  const CacVerificationScreen({super.key});
  @override
  State<CacVerificationScreen> createState() => _CacVerificationScreenState();
}

class _CacVerificationScreenState extends State<CacVerificationScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'company': 'Adebayo Holdings', 'rc': 'RC-123456', 'type': 'Private Ltd', 'date': '2024-01-10', 'status': 'Verified', },
    {'company': 'Chukwu Corp', 'rc': 'RC-789012', 'type': 'Public Ltd', 'date': '2024-01-11', 'status': 'Verified', },
    {'company': 'Ibrahim Trading', 'rc': 'RC-345678', 'type': 'Partnership', 'date': '2024-01-12', 'status': 'Pending', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('CAC Verification'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['company'].toString().substring(0, 1)),
                      ),
                      title: Text(item['company'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('RC Number: ${item["rc"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Type: ${item["type"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['status'] == 'Verified' ? Colors.green[100] : Colors.orange[100],
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
