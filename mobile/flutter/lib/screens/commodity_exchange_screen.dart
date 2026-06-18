import 'package:flutter/material.dart';

class CommodityExchangeScreen extends StatefulWidget {
  const CommodityExchangeScreen({super.key});
  @override
  State<CommodityExchangeScreen> createState() => _CommodityExchangeScreenState();
}

class _CommodityExchangeScreenState extends State<CommodityExchangeScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'commodity': 'Rice (50kg)', 'price': '₦42,000', 'change': '+2.5%', 'volume': '12,450', 'market': 'AFEX', },
    {'commodity': 'Maize (100kg)', 'price': '₦28,500', 'change': '-1.2%', 'volume': '8,900', 'market': 'AFEX', },
    {'commodity': 'Soybean (100kg)', 'price': '₦65,000', 'change': '+0.8%', 'volume': '5,600', 'market': 'AFEX', },
    {'commodity': 'Cocoa (50kg)', 'price': '₦850,000', 'change': '+5.2%', 'volume': '2,100', 'market': 'NCX', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Commodity Exchange'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['commodity'].toString().substring(0, 1)),
                      ),
                      title: Text(item['commodity'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Price: ${item["price"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Change: ${item["change"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Market: ${item["market"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
