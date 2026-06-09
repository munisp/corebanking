import 'package:flutter/material.dart';

class CustomerNotificationsScreen extends StatefulWidget {
  const CustomerNotificationsScreen({super.key});
  @override
  State<CustomerNotificationsScreen> createState() => _CustomerNotificationsScreenState();
}

class _CustomerNotificationsScreenState extends State<CustomerNotificationsScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'type': 'Transaction Alert', 'channel': 'SMS+Push', 'sent': '125K/day', 'delivery': '99.2%', 'status': 'Active', },
    {'type': 'Statement Ready', 'channel': 'Email', 'sent': '45K/month', 'delivery': '98.5%', 'status': 'Active', },
    {'type': 'Promotional', 'channel': 'Push', 'sent': '500K/week', 'delivery': '97.8%', 'status': 'Active', },
    {'type': 'Security Alert', 'channel': 'SMS+Email+Push', 'sent': '2K/day', 'delivery': '99.8%', 'status': 'Active', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Customer Notifications'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['type'].toString().substring(0, 1)),
                      ),
                      title: Text(item['type'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Channel: ${item["channel"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Delivery Rate: ${item["delivery"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
