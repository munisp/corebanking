import 'package:flutter/material.dart';

class LakehouseLineageEdgesScreen extends StatefulWidget {
  const LakehouseLineageEdgesScreen({super.key});
  @override
  State<LakehouseLineageEdgesScreen> createState() => _LakehouseLineageEdgesScreenState();
}

class _LakehouseLineageEdgesScreenState extends State<LakehouseLineageEdgesScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'name': 'Bronze Layer (Raw)', 'type': 'Landing Zone', 'value': '85GB/day ingested', 'status': 'Active'},
    {'name': 'Silver Layer (Cleaned)', 'type': 'Validated', 'value': '1,200 tables', 'status': 'Active'},
    {'name': 'Gold Layer (Curated)', 'type': 'Business-Ready', 'value': '450 tables', 'status': 'Active'},
    {'name': 'Delta Lake Compaction', 'type': 'Maintenance', 'value': 'Nightly', 'status': 'Scheduled'},
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
      appBar: AppBar(title: const Text('Lakehouse Lineage Edges'), backgroundColor: Colors.green[700]),
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
              _kpi('Tables', '2,500', Icons.table_chart),
              _kpi('Daily Ingestion', '85GB', Icons.cloud_upload),
              _kpi('Queries/Day', '45K', Icons.search),
              _kpi('Freshness', '< 5min', Icons.update),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: InputDecoration(
                hintText: 'Search lakehouse lineage edges...',
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
