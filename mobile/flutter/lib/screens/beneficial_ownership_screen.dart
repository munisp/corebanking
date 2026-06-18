import 'package:flutter/material.dart';

class BeneficialOwnershipScreen extends StatefulWidget {
  const BeneficialOwnershipScreen({super.key});
  @override
  State<BeneficialOwnershipScreen> createState() => _BeneficialOwnershipScreenState();
}

class _BeneficialOwnershipScreenState extends State<BeneficialOwnershipScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'entity': 'Adebayo Holdings Ltd', 'ubo': 'Chief Adebayo', 'ownership': '65%', 'pep': True, 'verified': True, 'status': 'Current', },
    {'entity': 'Chukwu Corp', 'ubo': 'Dr. Chukwu', 'ownership': '80%', 'pep': False, 'verified': True, 'status': 'Current', },
    {'entity': 'Ibrahim Group', 'ubo': 'Alhaji Ibrahim', 'ownership': '51%', 'pep': True, 'verified': False, 'status': 'Pending', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Beneficial Ownership'), backgroundColor: Colors.green[700]),
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
                    Text('UBO: ${item["ubo"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Ownership: ${item["ownership"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['status'] == 'Current' ? Colors.green[100] : Colors.orange[100],
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
