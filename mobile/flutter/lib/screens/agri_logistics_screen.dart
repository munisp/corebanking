import 'package:flutter/material.dart';

class AgriLogisticsScreen extends StatefulWidget {
  const AgriLogisticsScreen({super.key});
  @override
  State<AgriLogisticsScreen> createState() => _AgriLogisticsScreenState();
}

class _AgriLogisticsScreenState extends State<AgriLogisticsScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'shipment': 'SHP-001', 'crop': 'Rice 50t', 'origin': 'Kebbi', 'dest': 'Lagos', 'status': 'In Transit', },
    {'shipment': 'SHP-002', 'crop': 'Maize 30t', 'origin': 'Kaduna', 'dest': 'Abuja', 'status': 'Delivered', },
    {'shipment': 'SHP-003', 'crop': 'Cassava 40t', 'origin': 'Ogun', 'dest': 'Ibadan', 'status': 'Loading', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Agriculture Logistics'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['shipment'].toString().substring(0, 1)),
                      ),
                      title: Text(item['shipment'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Cargo: ${item["crop"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('From: ${item["origin"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['status'] == 'Delivered' ? Colors.green[100] : Colors.orange[100],
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
