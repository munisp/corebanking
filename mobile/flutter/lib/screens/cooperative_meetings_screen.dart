import 'package:flutter/material.dart';

class CooperativeMeetingsScreen extends StatefulWidget {
  const CooperativeMeetingsScreen({super.key});
  @override
  State<CooperativeMeetingsScreen> createState() => _CooperativeMeetingsScreenState();
}

class _CooperativeMeetingsScreenState extends State<CooperativeMeetingsScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'coop': 'Kano Rice Coop', 'date': '2024-02-15', 'type': 'AGM', 'attendance': '85%', 'agenda': 'Annual Review', 'status': 'Scheduled', },
    {'coop': 'Lagos Market Women', 'date': '2024-01-20', 'type': 'Monthly', 'attendance': '72%', 'agenda': 'Loan Disbursement', 'status': 'Completed', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cooperative Meetings'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['coop'].toString().substring(0, 1)),
                      ),
                      title: Text(item['coop'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Date: ${item["date"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Type: ${item["type"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['status'] == 'Completed' ? Colors.green[100] : Colors.orange[100],
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
