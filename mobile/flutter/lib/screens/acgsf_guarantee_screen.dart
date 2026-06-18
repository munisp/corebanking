import 'package:flutter/material.dart';

class AcgsfGuaranteeScreen extends StatefulWidget {
  const AcgsfGuaranteeScreen({super.key});
  @override
  State<AcgsfGuaranteeScreen> createState() => _AcgsfGuaranteeScreenState();
}

class _AcgsfGuaranteeScreenState extends State<AcgsfGuaranteeScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'farmer': 'Kano Rice Cluster', 'amount': '₦15M', 'guarantee': '75%', 'status': 'Active', },
    {'farmer': 'Ogun Cassava Coop', 'amount': '₦8.5M', 'guarantee': '75%', 'status': 'Active', },
    {'farmer': 'Benue Soybean', 'amount': '₦22M', 'guarantee': '75%', 'status': 'Pending', },
    {'farmer': 'Kaduna Maize', 'amount': '₦12M', 'guarantee': '75%', 'status': 'Claimed', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ACGSF Guarantee'), backgroundColor: Colors.green[700]),
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
                    Text('Coverage: ${item["guarantee"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
