import 'package:flutter/material.dart';

class MandateManagementScreen extends StatefulWidget {
  const MandateManagementScreen({super.key});
  @override
  State<MandateManagementScreen> createState() => _MandateManagementScreenState();
}

class _MandateManagementScreenState extends State<MandateManagementScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'name': 'NIBSS Direct Debit Mandate', 'type': 'Auto-Debit', 'value': '₦500K max', 'status': 'Active'},
    {'name': 'Standing Order Mandate', 'type': 'Recurring', 'value': 'Monthly/Weekly', 'status': 'Active'},
    {'name': 'Salary Deduction Authority', 'type': 'Employer', 'value': '% of salary', 'status': 'Active'},
    {'name': 'Insurance Premium Mandate', 'type': 'Annual', 'value': '₦250K avg', 'status': 'Active'},
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  Widget _kpi(String label, String value, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Colors.green[700], size: 20),
            const Spacer(),
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mandate Management'), backgroundColor: Colors.green[700]),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.6,
              children: [
              _kpi('Active Mandates', '125K', Icons.description),
              _kpi('Direct Debits', '85K/month', Icons.swap_horiz),
              _kpi('Failed', '1.2%', Icons.error),
              _kpi('Revenue', '₦850M', Icons.money),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: InputDecoration(
                hintText: 'Search mandate management...',
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
                        child: Text(item['name'].toString().substring(0, 1)),
                      ),
                      title: Text(item['name'].toString()),
                      subtitle: Text('${item['type']} — ${item['value']}'),
                      trailing: Chip(
                        label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                        backgroundColor: item['status'] == 'Active' ? Colors.green[100] : Colors.orange[100],
                      ),
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
