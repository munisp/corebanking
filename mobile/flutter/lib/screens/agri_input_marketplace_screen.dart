import 'package:flutter/material.dart';

class AgriInputMarketplaceScreen extends StatefulWidget {
  const AgriInputMarketplaceScreen({super.key});
  @override
  State<AgriInputMarketplaceScreen> createState() => _AgriInputMarketplaceScreenState();
}

class _AgriInputMarketplaceScreenState extends State<AgriInputMarketplaceScreen> {
  String _category = 'All';
  final List<Map<String, dynamic>> _products = [
    {'name': 'NPK 15:15:15 Fertilizer', 'category': 'Fertilizer', 'vendor': 'Notore Chemical', 'price': 18500, 'unit': '50kg bag', 'rating': 4.5},
    {'name': 'Glyphosate Herbicide', 'category': 'Chemicals', 'vendor': 'Syngenta NG', 'price': 4200, 'unit': '1L', 'rating': 4.2},
    {'name': 'FARO 44 Rice Seeds', 'category': 'Seeds', 'vendor': 'NCRI', 'price': 12000, 'unit': '25kg', 'rating': 4.8},
    {'name': 'Knapsack Sprayer', 'category': 'Equipment', 'vendor': 'Agro Dealers NG', 'price': 35000, 'unit': '16L', 'rating': 3.9},
    {'name': 'Drip Irrigation Kit', 'category': 'Equipment', 'vendor': 'Dizengoff', 'price': 250000, 'unit': '1 acre kit', 'rating': 4.6},
    {'name': 'Urea Fertilizer', 'category': 'Fertilizer', 'vendor': 'Indorama', 'price': 22000, 'unit': '50kg bag', 'rating': 4.3},
  ];

  @override
  Widget build(BuildContext context) {
    final filtered = _category == 'All' ? _products : _products.where((p) => p['category'] == _category).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Agri Input Marketplace'), backgroundColor: Colors.green[700]),
      body: Column(children: [
        SingleChildScrollView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.all(8), child: Row(children: [
          for (final cat in ['All', 'Fertilizer', 'Seeds', 'Chemicals', 'Equipment'])
            Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(cat), selected: _category == cat,
              onSelected: (v) => setState(() => _category = cat))),
        ])),
        Expanded(child: ListView.builder(itemCount: filtered.length, itemBuilder: (ctx, i) {
          final p = filtered[i];
          return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ListTile(
            leading: const CircleAvatar(child: Icon(Icons.agriculture)),
            title: Text(p['name'] as String), subtitle: Text('${p["vendor"]} | ${p["unit"]}'),
            trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('₦${((p["price"] as int) / 100).toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green)),
              Row(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.star, size: 14, color: Colors.amber), Text('${p["rating"]}')]),
            ]),
          ));
        })),
      ]),
    );
  }
}
