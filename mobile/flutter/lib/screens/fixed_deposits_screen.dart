import 'package:flutter/material.dart';

class FixedDepositsScreen extends StatefulWidget {
  const FixedDepositsScreen({super.key});
  @override
  State<FixedDepositsScreen> createState() => _FixedDepositsScreenState();
}

class _FixedDepositsScreenState extends State<FixedDepositsScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'name': '90-Day Tenor @ 18%', 'type': 'Standard FD', 'value': '₦25M min', 'status': 'Active'},
    {'name': '180-Day Tenor @ 20%', 'type': 'Premium FD', 'value': '₦100M min', 'status': 'Active'},
    {'name': '365-Day Tenor @ 22%', 'type': 'Treasury FD', 'value': '₦500M min', 'status': 'Active'},
    {'name': 'Call Deposit @ 15%', 'type': 'Callable FD', 'value': '₦10M min', 'status': 'Active'},
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
      appBar: AppBar(title: const Text('Fixed Deposits'), backgroundColor: Colors.green[700]),
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
              _kpi('Total Deposits', '₦180B', Icons.savings),
              _kpi('Active FDs', '45,000', Icons.receipt),
              _kpi('Avg Rate', '18.5%', Icons.percent),
              _kpi('Maturing 30d', '₦12B', Icons.schedule),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: InputDecoration(
                hintText: 'Search fixed deposits...',
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
