import 'package:flutter/material.dart';

class AgriEvoucherScreen extends StatefulWidget {
  const AgriEvoucherScreen({super.key});
  @override
  State<AgriEvoucherScreen> createState() => _AgriEvoucherScreenState();
}

class _AgriEvoucherScreenState extends State<AgriEvoucherScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'farmer': 'Abdullahi M.', 'voucher': 'EVR-001', 'amount': '₦150K', 'input': 'Fertilizer', 'status': 'Redeemed', },
    {'farmer': 'Blessing O.', 'voucher': 'EVR-002', 'amount': '₦85K', 'input': 'Seeds', 'status': 'Active', },
    {'farmer': 'Chidi N.', 'voucher': 'EVR-003', 'amount': '₦200K', 'input': 'Agrochemicals', 'status': 'Active', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Agriculture E-Voucher'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['farmer'].toString().substring(0, 1)),
                      ),
                      title: Text(item['farmer'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Amount: ${item["amount"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Input: ${item["input"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
