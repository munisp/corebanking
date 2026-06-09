import 'package:flutter/material.dart';

/// Insurance — Buy/manage insurance policies (motor, health, travel, life)
class InsuranceScreen extends StatefulWidget {
  const InsuranceScreen({super.key});
  @override
  State<InsuranceScreen> createState() => _InsuranceScreenState();
}

class _InsuranceScreenState extends State<InsuranceScreen> {
  final _products = [
    {'id': 'motor', 'name': 'Motor Insurance', 'icon': Icons.directions_car, 'color': Colors.blue, 'from': 15000, 'desc': 'Third Party & Comprehensive'},
    {'id': 'health', 'name': 'Health Insurance', 'icon': Icons.health_and_safety, 'color': Colors.red, 'from': 50000, 'desc': 'HMO Plans (NHIS compliant)'},
    {'id': 'travel', 'name': 'Travel Insurance', 'icon': Icons.flight, 'color': Colors.purple, 'from': 5000, 'desc': 'Visa-compliant coverage'},
    {'id': 'life', 'name': 'Life Insurance', 'icon': Icons.shield, 'color': Colors.green, 'from': 25000, 'desc': 'Term & Whole Life policies'},
    {'id': 'home', 'name': 'Home Insurance', 'icon': Icons.home, 'color': Colors.orange, 'from': 30000, 'desc': 'Building & contents cover'},
    {'id': 'gadget', 'name': 'Gadget Insurance', 'icon': Icons.phone_android, 'color': Colors.teal, 'from': 8000, 'desc': 'Phone & laptop protection'},
  ];

  final _activePolicies = [
    {'product': 'Motor Insurance', 'provider': 'Leadway Assurance', 'expires': '2027-03-15', 'premium': 45000, 'status': 'active'},
    {'product': 'Health Insurance', 'provider': 'Hygeia HMO', 'expires': '2026-12-31', 'premium': 120000, 'status': 'active'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Insurance')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        // Active policies
        if (_activePolicies.isNotEmpty) ...[
          const Text('My Policies', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          ..._activePolicies.map((p) => Card(child: ListTile(
            leading: const CircleAvatar(backgroundColor: Colors.green, child: Icon(Icons.verified, color: Colors.white, size: 20)),
            title: Text(p['product'] as String),
            subtitle: Text('${p["provider"]} • Expires: ${p["expires"]}'),
            trailing: Text('\u20A6${p["premium"]}/yr', style: const TextStyle(fontWeight: FontWeight.bold)),
            onTap: () {},
          ))),
          const Divider(height: 32),
        ],
        // Browse products
        const Text('Buy Insurance', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.9),
          itemCount: _products.length,
          itemBuilder: (ctx, i) {
            final p = _products[i];
            return Card(child: InkWell(onTap: () => _showProductDetail(p), child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(p['icon'] as IconData, size: 36, color: p['color'] as Color),
                const SizedBox(height: 8),
                Text(p['name'] as String, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 4),
                Text(p['desc'] as String, textAlign: TextAlign.center, style: const TextStyle(fontSize: 10, color: Colors.grey)),
                const SizedBox(height: 8),
                Text('From \u20A6${p["from"]}/yr', style: TextStyle(color: p['color'] as Color, fontWeight: FontWeight.w500, fontSize: 12)),
              ]),
            )));
          },
        ),
      ]),
    );
  }

  void _showProductDetail(Map<String, dynamic> product) {
    showModalBottomSheet(context: context, builder: (ctx) => Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [Icon(product['icon'] as IconData, color: product['color'] as Color, size: 32), const SizedBox(width: 12),
          Text(product['name'] as String, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold))]),
        const SizedBox(height: 16),
        Text(product['desc'] as String),
        const SizedBox(height: 8),
        Text('Starting from \u20A6${product["from"]}/year', style: const TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        const Text('Providers:', style: TextStyle(fontWeight: FontWeight.w500)),
        const Text('• Leadway Assurance\n• AXA Mansard\n• AIICO Insurance\n• Custodian Investment', style: TextStyle(fontSize: 13)),
        const SizedBox(height: 16),
        ElevatedButton(onPressed: () { Navigator.pop(ctx); }, child: const Text('Get Quote')),
      ]),
    ));
  }
}
