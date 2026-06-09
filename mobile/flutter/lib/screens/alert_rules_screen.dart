import 'package:flutter/material.dart';

class AlertRulesScreen extends StatefulWidget {
  const AlertRulesScreen({super.key});
  @override
  State<AlertRulesScreen> createState() => _AlertRulesScreenState();
}

class _AlertRulesScreenState extends State<AlertRulesScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'rule': 'High-Value Transfer', 'condition': 'Amount > ₦10M', 'channel': 'SMS+Email', 'status': 'Active', },
    {'rule': 'Failed Logins', 'condition': '>3 in 5min', 'channel': 'Push+SMS', 'status': 'Active', },
    {'rule': 'Dormant Activity', 'condition': 'No txn > 180d', 'channel': 'Email', 'status': 'Active', },
    {'rule': 'Balance Threshold', 'condition': 'Balance < ₦5K', 'channel': 'Push', 'status': 'Paused', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Alert Rules'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['rule'].toString().substring(0, 1)),
                      ),
                      title: Text(item['rule'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Condition: ${item["condition"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Channel: ${item["channel"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
