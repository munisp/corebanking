import 'package:flutter/material.dart';

class CorrespondentBankingScreen extends StatefulWidget {
  const CorrespondentBankingScreen({super.key});
  @override
  State<CorrespondentBankingScreen> createState() => _CorrespondentBankingScreenState();
}

class _CorrespondentBankingScreenState extends State<CorrespondentBankingScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'bank': 'JPMorgan Chase', 'swift': 'CHASUS33', 'currency': 'USD', 'nostro': '₦45B equiv', 'status': 'Active', },
    {'bank': 'Standard Chartered', 'swift': 'SCBLGB2L', 'currency': 'GBP', 'nostro': '₦12B equiv', 'status': 'Active', },
    {'bank': 'Deutsche Bank', 'swift': 'DEUTDEFF', 'currency': 'EUR', 'nostro': '₦8B equiv', 'status': 'Active', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Correspondent Banking'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['bank'].toString().substring(0, 1)),
                      ),
                      title: Text(item['bank'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('SWIFT: ${item["swift"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Currency: ${item["currency"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
