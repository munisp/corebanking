import 'package:flutter/material.dart';

class CrossborderAgriTradeScreen extends StatefulWidget {
  const CrossborderAgriTradeScreen({super.key});
  @override
  State<CrossborderAgriTradeScreen> createState() => _CrossborderAgriTradeScreenState();
}

class _CrossborderAgriTradeScreenState extends State<CrossborderAgriTradeScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'trade': 'TRD-001', 'commodity': 'Cocoa', 'buyer': 'Netherlands', 'value': '$2.4M', 'incoterm': 'FOB Lagos', 'status': 'In Progress', },
    {'trade': 'TRD-002', 'commodity': 'Sesame', 'buyer': 'Japan', 'value': '$1.8M', 'incoterm': 'CIF Tokyo', 'status': 'Completed', },
    {'trade': 'TRD-003', 'commodity': 'Cashew', 'buyer': 'Vietnam', 'value': '$3.2M', 'incoterm': 'FOB Lagos', 'status': 'Pending LC', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cross-border Agri Trade'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['trade'].toString().substring(0, 1)),
                      ),
                      title: Text(item['trade'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Commodity: ${item["commodity"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Value: ${item["value"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
