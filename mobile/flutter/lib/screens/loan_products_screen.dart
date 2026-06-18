import 'package:flutter/material.dart';

class LoanProductsScreen extends StatefulWidget {
  const LoanProductsScreen({super.key});
  @override
  State<LoanProductsScreen> createState() => _LoanProductsScreenState();
}

class _LoanProductsScreenState extends State<LoanProductsScreen> {
  final List<Map<String, dynamic>> _products = [
    {'name': 'Instant Cash', 'rate': '24.0%', 'maxAmount': 500000, 'maxTenor': '3 months', 'collateral': 'None', 'icon': Icons.flash_on, 'color': Colors.amber},
    {'name': 'Personal Loan', 'rate': '18.5%', 'maxAmount': 5000000, 'maxTenor': '36 months', 'collateral': 'Salary assignment', 'icon': Icons.person, 'color': Colors.blue},
    {'name': 'Auto Loan', 'rate': '14.0%', 'maxAmount': 15000000, 'maxTenor': '60 months', 'collateral': 'Vehicle lien', 'icon': Icons.directions_car, 'color': Colors.green},
    {'name': 'Mortgage', 'rate': '12.5%', 'maxAmount': 100000000, 'maxTenor': '25 years', 'collateral': 'Property', 'icon': Icons.home, 'color': Colors.purple},
    {'name': 'SME Loan', 'rate': '16.0%', 'maxAmount': 50000000, 'maxTenor': '48 months', 'collateral': 'Business assets', 'icon': Icons.business, 'color': Colors.orange},
    {'name': 'Agri Loan (ABP)', 'rate': '9.0%', 'maxAmount': 10000000, 'maxTenor': '12 months', 'collateral': 'Crop/livestock', 'icon': Icons.agriculture, 'color': Colors.teal},
    {'name': 'Education Loan', 'rate': '15.0%', 'maxAmount': 8000000, 'maxTenor': '48 months', 'collateral': 'Guarantor', 'icon': Icons.school, 'color': Colors.indigo},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Loan Products')),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _products.length,
        itemBuilder: (ctx, i) {
          final p = _products[i];
          return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                CircleAvatar(backgroundColor: p['color'], child: Icon(p['icon'], color: Colors.white)),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p['name'], style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  Text('From ${p["rate"]} p.a.', style: const TextStyle(color: Colors.grey)),
                ])),
              ]),
              const Divider(),
              Row(children: [
                Expanded(child: _infoChip('Max', '\u20A6${(p["maxAmount"] / 100).toStringAsFixed(0)}')),
                Expanded(child: _infoChip('Tenor', p['maxTenor'])),
                Expanded(child: _infoChip('Security', p['collateral'])),
              ]),
              const SizedBox(height: 12),
              SizedBox(width: double.infinity, child: OutlinedButton(
                onPressed: () {}, child: const Text('Apply Now'))),
            ],
          )));
        },
      ),
    );
  }

  Widget _infoChip(String label, String value) => Column(children: [
    Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
    const SizedBox(height: 2),
    Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500), textAlign: TextAlign.center),
  ]);
}
