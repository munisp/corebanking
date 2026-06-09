import 'package:flutter/material.dart';

class BatchAggregatorScreen extends StatefulWidget {
  const BatchAggregatorScreen({super.key});
  @override
  State<BatchAggregatorScreen> createState() => _BatchAggregatorScreenState();
}

class _BatchAggregatorScreenState extends State<BatchAggregatorScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'batch': 'BAT-001', 'type': 'Salary', 'records': 2450, 'amount': '₦1.2B', 'status': 'Completed', 'time': '3.2min', },
    {'batch': 'BAT-002', 'type': 'Vendor Pay', 'records': 180, 'amount': '₦450M', 'status': 'Processing', 'time': '1.5min', },
    {'batch': 'BAT-003', 'type': 'Pension', 'records': 8900, 'amount': '₦3.8B', 'status': 'Queued', 'time': 'Est 8min', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Batch Aggregator'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['batch'].toString().substring(0, 1)),
                      ),
                      title: Text(item['batch'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Type: ${item["type"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Amount: ${item["amount"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
