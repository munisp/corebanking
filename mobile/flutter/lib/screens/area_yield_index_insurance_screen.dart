import 'package:flutter/material.dart';

class AreaYieldIndexInsuranceScreen extends StatefulWidget {
  const AreaYieldIndexInsuranceScreen({super.key});
  @override
  State<AreaYieldIndexInsuranceScreen> createState() => _AreaYieldIndexInsuranceScreenState();
}

class _AreaYieldIndexInsuranceScreenState extends State<AreaYieldIndexInsuranceScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'zone': 'Kano North', 'crop': 'Rice', 'trigger': '< 2.5t/ha', 'premium': '₦15K/ha', 'payout': '₦150K/ha', 'status': 'Active', },
    {'zone': 'Kaduna South', 'crop': 'Maize', 'trigger': '< 3.0t/ha', 'premium': '₦12K/ha', 'payout': '₦120K/ha', 'status': 'Active', },
    {'zone': 'Benue Central', 'crop': 'Soybean', 'trigger': '< 1.5t/ha', 'premium': '₦10K/ha', 'payout': '₦100K/ha', 'status': 'Triggered', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Area Yield Index Insurance'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['zone'].toString().substring(0, 1)),
                      ),
                      title: Text(item['zone'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Crop: ${item["crop"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Trigger: ${item["trigger"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
