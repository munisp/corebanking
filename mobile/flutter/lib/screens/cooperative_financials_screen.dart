import 'package:flutter/material.dart';

class CooperativeFinancialsScreen extends StatefulWidget {
  const CooperativeFinancialsScreen({super.key});
  @override
  State<CooperativeFinancialsScreen> createState() => _CooperativeFinancialsScreenState();
}

class _CooperativeFinancialsScreenState extends State<CooperativeFinancialsScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'coop': 'Kano Rice Coop', 'savings': '₦45M', 'loans': '₦38M', 'surplus': '₦7M', 'roi': '15.5%', 'status': 'Healthy', },
    {'coop': 'Lagos Market Women', 'savings': '₦28M', 'loans': '₦22M', 'surplus': '₦6M', 'roi': '21.4%', 'status': 'Healthy', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cooperative Financials'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['coop'].toString().substring(0, 1)),
                      ),
                      title: Text(item['coop'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Savings: ${item["savings"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Loans: ${item["loans"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['status'] == 'Healthy' ? Colors.green[100] : Colors.orange[100],
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
