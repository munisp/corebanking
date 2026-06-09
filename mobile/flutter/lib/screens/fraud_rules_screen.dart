import 'package:flutter/material.dart';

class FraudRulesScreen extends StatefulWidget {
  const FraudRulesScreen({super.key});
  @override
  State<FraudRulesScreen> createState() => _FraudRulesScreenState();
}

class _FraudRulesScreenState extends State<FraudRulesScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'name': 'Velocity Check (>5 txns/min)', 'type': 'Real-time', 'value': '450 triggers/day', 'status': 'Active'},
    {'name': 'Amount Threshold (>₦5M)', 'type': 'Real-time', 'value': '1,200 triggers/day', 'status': 'Active'},
    {'name': 'Geo-velocity (impossible travel)', 'type': 'ML Model', 'value': '85 triggers/day', 'status': 'Active'},
    {'name': 'Device Fingerprint Mismatch', 'type': 'Behavioral', 'value': '250 triggers/day', 'status': 'Active'},
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
      appBar: AppBar(title: const Text('Fraud Rules'), backgroundColor: Colors.green[700]),
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
              _kpi('Active Rules', '450', Icons.rule),
              _kpi('Alerts Today', '12K', Icons.warning),
              _kpi('Blocked Txns', '850', Icons.block),
              _kpi('False Positive', '2.5%', Icons.error),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: InputDecoration(
                hintText: 'Search fraud rules...',
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
