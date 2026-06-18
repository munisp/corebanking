import 'package:flutter/material.dart';

class CustomerStatementsScreen extends StatefulWidget {
  const CustomerStatementsScreen({super.key});
  @override
  State<CustomerStatementsScreen> createState() => _CustomerStatementsScreenState();
}

class _CustomerStatementsScreenState extends State<CustomerStatementsScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'customer': 'Adebayo M.', 'type': 'Monthly', 'format': 'PDF', 'period': 'Jan 2024', 'generated': '2024-02-01', 'status': 'Sent', },
    {'customer': 'Chukwu Corp', 'type': 'Daily', 'format': 'CSV', 'period': '2024-01-15', 'generated': '2024-01-16', 'status': 'Sent', },
    {'customer': 'Ibrahim K.', 'type': 'Quarterly', 'format': 'PDF', 'period': 'Q4 2023', 'generated': '2024-01-05', 'status': 'Downloaded', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Customer Statements'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['customer'].toString().substring(0, 1)),
                      ),
                      title: Text(item['customer'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Type: ${item["type"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Format: ${item["format"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['status'] == 'Sent' ? Colors.green[100] : Colors.orange[100],
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
