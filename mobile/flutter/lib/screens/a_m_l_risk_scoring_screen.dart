import 'package:flutter/material.dart';

class AMLRiskScoringScreen extends StatefulWidget {
  const AMLRiskScoringScreen({super.key});
  @override
  State<AMLRiskScoringScreen> createState() => _AMLRiskScoringScreenState();
}

class _AMLRiskScoringScreenState extends State<AMLRiskScoringScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'customer': 'Adebayo Holdings', 'score': 85, 'level': 'High', 'factors': 'PEP, Large Cash', },
    {'customer': 'Ngozi Enterprises', 'score': 42, 'level': 'Medium', 'factors': 'Cross-border', },
    {'customer': 'Chukwu & Sons', 'score': 15, 'level': 'Low', 'factors': 'Domestic only', },
    {'customer': 'Ibrahim Trading', 'score': 72, 'level': 'High', 'factors': 'Sanctions proximity', },
    {'customer': 'Bello Logistics', 'score': 91, 'level': 'Critical', 'factors': 'PEP, Sanctions match', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AML Risk Scoring'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['customer'].toString().substring(0, 1)),
                      ),
                      title: Text(item['customer'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Score: ${item["score"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['level'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['level'] == 'Low' ? Colors.green[100] : Colors.orange[100],
                    ),
                    Text('Factors: ${item["factors"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
