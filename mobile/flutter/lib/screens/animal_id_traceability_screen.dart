import 'package:flutter/material.dart';

class AnimalIdTraceabilityScreen extends StatefulWidget {
  const AnimalIdTraceabilityScreen({super.key});
  @override
  State<AnimalIdTraceabilityScreen> createState() => _AnimalIdTraceabilityScreenState();
}

class _AnimalIdTraceabilityScreenState extends State<AnimalIdTraceabilityScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'tag': 'LVS-0001', 'type': 'Cattle', 'breed': 'White Fulani', 'farm': 'Kano Ranch', 'status': 'Active', },
    {'tag': 'LVS-0002', 'type': 'Goat', 'breed': 'Red Sokoto', 'farm': 'Sokoto Farm', 'status': 'Active', },
    {'tag': 'LVS-0003', 'type': 'Poultry', 'breed': 'Noiler', 'farm': 'Ogun Poultry', 'status': 'Sold', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Animal ID Traceability'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['tag'].toString().substring(0, 1)),
                      ),
                      title: Text(item['tag'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Type: ${item["type"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Breed: ${item["breed"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
