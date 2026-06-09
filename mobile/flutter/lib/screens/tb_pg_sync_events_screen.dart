import 'package:flutter/material.dart';

class TBPGSyncEventsScreen extends StatefulWidget {
  const TBPGSyncEventsScreen({super.key});
  @override
  State<TBPGSyncEventsScreen> createState() => _TBPGSyncEventsScreenState();
}

class _TBPGSyncEventsScreenState extends State<TBPGSyncEventsScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'name': 'TigerBeetle → PostgreSQL Sync', 'type': 'Real-time CDC', 'value': '85K events/s', 'status': 'Synced'},
    {'name': 'Balance Cache Refresh', 'type': 'Materialized View', 'value': '< 100ms stale', 'status': 'Active'},
    {'name': 'Reconciliation Run', 'type': 'Hourly', 'value': '₦0.00 variance', 'status': 'Balanced'},
    {'name': 'Saga Compensation', 'type': 'Distributed Tx', 'value': '99.99% success', 'status': 'Active'},
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
      appBar: AppBar(title: const Text('TB PG Sync Events'), backgroundColor: Colors.green[700]),
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
              _kpi('Accounts', '2.5M', Icons.account_balance),
              _kpi('Transfers/s', '85K', Icons.swap_horiz),
              _kpi('Ledger Balanced', '₦0.00', Icons.balance),
              _kpi('Reconciled', '100%', Icons.check_circle),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: InputDecoration(
                hintText: 'Search tb pg sync events...',
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
