import 'package:flutter/material.dart';

class CTRAutoFilerScreen extends StatefulWidget {
  const CTRAutoFilerScreen({super.key});
  @override
  State<CTRAutoFilerScreen> createState() => _CTRAutoFilerScreenState();
}

class _CTRAutoFilerScreenState extends State<CTRAutoFilerScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'ref': 'CTR-2024-001', 'customer': 'Adebayo M.', 'amount': '₦6,500,000', 'type': 'Cash Deposit', 'filed': '2024-01-15', 'status': 'Filed', },
    {'ref': 'CTR-2024-002', 'customer': 'Ibrahim K.', 'amount': '₦12,000,000', 'type': 'Wire Transfer', 'filed': '2024-01-14', 'status': 'Filed', },
    {'ref': 'CTR-2024-003', 'customer': 'Chukwu E.', 'amount': '₦5,200,000', 'type': 'Cash Withdrawal', 'filed': '2024-01-13', 'status': 'Pending Review', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('CTR Auto Filer'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['ref'].toString().substring(0, 1)),
                      ),
                      title: Text(item['ref'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Customer: ${item["customer"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Amount: ${item["amount"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['status'] == 'Filed' ? Colors.green[100] : Colors.orange[100],
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
