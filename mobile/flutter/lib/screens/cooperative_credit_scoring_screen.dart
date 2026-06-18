import 'package:flutter/material.dart';

class CooperativeCreditScoringScreen extends StatefulWidget {
  const CooperativeCreditScoringScreen({super.key});
  @override
  State<CooperativeCreditScoringScreen> createState() => _CooperativeCreditScoringScreenState();
}

class _CooperativeCreditScoringScreenState extends State<CooperativeCreditScoringScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'coop': 'Kano Rice Coop', 'members': 250, 'score': 78, 'repayment': '92%', 'limit': '₦50M', 'status': 'Approved', },
    {'coop': 'Lagos Market Women', 'members': 180, 'score': 85, 'repayment': '96%', 'limit': '₦35M', 'status': 'Approved', },
    {'coop': 'Benue Farmers Union', 'members': 420, 'score': 65, 'repayment': '82%', 'limit': '₦25M', 'status': 'Under Review', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cooperative Credit Scoring'), backgroundColor: Colors.green[700]),
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
                    Text('Members: ${item["members"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Score: ${item["score"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['status'] == 'Approved' ? Colors.green[100] : Colors.orange[100],
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
