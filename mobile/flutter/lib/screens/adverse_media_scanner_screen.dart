import 'package:flutter/material.dart';

class AdverseMediaScannerScreen extends StatefulWidget {
  const AdverseMediaScannerScreen({super.key});
  @override
  State<AdverseMediaScannerScreen> createState() => _AdverseMediaScannerScreenState();
}

class _AdverseMediaScannerScreenState extends State<AdverseMediaScannerScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'entity': 'Bello Trading', 'source': 'Reuters', 'category': 'Fraud', 'severity': 'High', },
    {'entity': 'Kalu Investments', 'source': 'ThisDay', 'category': 'Tax Evasion', 'severity': 'Medium', },
    {'entity': 'Danladi Group', 'source': 'Guardian', 'category': 'Money Laundering', 'severity': 'Critical', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Adverse Media Scanner'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['entity'].toString().substring(0, 1)),
                      ),
                      title: Text(item['entity'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Source: ${item["source"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Category: ${item["category"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['severity'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['severity'] == 'Low' ? Colors.green[100] : Colors.orange[100],
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
