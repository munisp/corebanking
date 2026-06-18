import 'package:flutter/material.dart';

class CardFraudRulesScreen extends StatefulWidget {
  const CardFraudRulesScreen({super.key});
  @override
  State<CardFraudRulesScreen> createState() => _CardFraudRulesScreenState();
}

class _CardFraudRulesScreenState extends State<CardFraudRulesScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'rule': 'Velocity Check', 'condition': '> 5 txns/5min', 'action': 'Block + Alert', 'status': 'Active', 'triggers': 23, },
    {'rule': 'Geographic Anomaly', 'condition': 'Cross-country < 1hr', 'action': '3DS Challenge', 'status': 'Active', 'triggers': 8, },
    {'rule': 'Amount Threshold', 'condition': '> ₦500K single', 'action': 'OTP Required', 'status': 'Active', 'triggers': 45, },
    {'rule': 'Merchant Category', 'condition': 'High-risk MCC', 'action': 'Enhanced Auth', 'status': 'Active', 'triggers': 12, },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Card Fraud Rules'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['rule'].toString().substring(0, 1)),
                      ),
                      title: Text(item['rule'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Condition: ${item["condition"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Action: ${item["action"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
