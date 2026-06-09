import 'package:flutter/material.dart';

class CbnAgriReturnsScreen extends StatefulWidget {
  const CbnAgriReturnsScreen({super.key});
  @override
  State<CbnAgriReturnsScreen> createState() => _CbnAgriReturnsScreenState();
}

class _CbnAgriReturnsScreenState extends State<CbnAgriReturnsScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'report': 'Anchor Borrowers Status', 'period': 'Q4 2024', 'submissions': 2450, 'amount': '₦45B', 'status': 'Submitted', },
    {'report': 'ACGSF Utilization', 'period': 'Q4 2024', 'submissions': 180, 'amount': '₦8.5B', 'status': 'Submitted', },
    {'report': 'Agri-Credit Guarantee', 'period': 'Q4 2024', 'submissions': 95, 'amount': '₦3.2B', 'status': 'Draft', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('CBN Agriculture Returns'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['report'].toString().substring(0, 1)),
                      ),
                      title: Text(item['report'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Period: ${item["period"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Amount: ${item["amount"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['status'] == 'Submitted' ? Colors.green[100] : Colors.orange[100],
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
