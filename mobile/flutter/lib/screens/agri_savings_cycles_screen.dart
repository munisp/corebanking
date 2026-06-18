import 'package:flutter/material.dart';

class AgriSavingsCyclesScreen extends StatefulWidget {
  const AgriSavingsCyclesScreen({super.key});
  @override
  State<AgriSavingsCyclesScreen> createState() => _AgriSavingsCyclesScreenState();
}

class _AgriSavingsCyclesScreenState extends State<AgriSavingsCyclesScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'group': 'Kano Rice Coop', 'members': 25, 'cycle': '₦500K/mo', 'pot': '₦3M', 'status': 'Active', },
    {'group': 'Ogun Cassava Women', 'members': 15, 'cycle': '₦200K/mo', 'pot': '₦1.8M', 'status': 'Active', },
    {'group': 'Benue Soybean', 'members': 30, 'cycle': '₦1M/mo', 'pot': '₦8M', 'status': 'Active', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Agri Savings Cycles'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['group'].toString().substring(0, 1)),
                      ),
                      title: Text(item['group'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Members: ${item["members"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Cycle: ${item["cycle"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
