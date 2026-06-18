import 'package:flutter/material.dart';

class EducationLoansScreen extends StatefulWidget {
  const EducationLoansScreen({super.key});
  @override
  State<EducationLoansScreen> createState() => _EducationLoansScreenState();
}

class _EducationLoansScreenState extends State<EducationLoansScreen> {
  final List<Map<String, dynamic>> _products = [
    {'name': 'Undergraduate Loan', 'rate': 15.0, 'maxAmount': 5000000, 'tenor': '4 years', 'moratorium': '6 months after NYSC'},
    {'name': 'Postgraduate Loan', 'rate': 12.0, 'maxAmount': 10000000, 'tenor': '3 years', 'moratorium': '3 months after graduation'},
    {'name': 'Professional Cert', 'rate': 18.0, 'maxAmount': 2000000, 'tenor': '2 years', 'moratorium': 'None'},
    {'name': 'Study Abroad', 'rate': 10.0, 'maxAmount': 25000000, 'tenor': '5 years', 'moratorium': '6 months after return'},
  ];
  
  int _selectedProduct = 0;
  double _amount = 3000000;

  @override
  Widget build(BuildContext context) {
    final product = _products[_selectedProduct];
    final monthlyPayment = _amount * ((product['rate'] as double) / 100 / 12);
    return Scaffold(
      appBar: AppBar(title: const Text('Education Loans'), backgroundColor: Colors.indigo),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Loan Products', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        ...List.generate(_products.length, (i) {
          final p = _products[i];
          return Card(color: i == _selectedProduct ? Colors.indigo[50] : null,
            child: ListTile(
              leading: Radio<int>(value: i, groupValue: _selectedProduct, onChanged: (v) => setState(() => _selectedProduct = v!)),
              title: Text(p['name'] as String), subtitle: Text('Rate: ${p["rate"]}% | Max: ₦${((p["maxAmount"] as int) / 1000000).toStringAsFixed(0)}M | Tenor: ${p["tenor"]}\nMoratorium: ${p["moratorium"]}'),
            ));
        }),
        const SizedBox(height: 16),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Loan Calculator', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          Text('Amount: ₦${(_amount / 1000000).toStringAsFixed(1)}M'),
          Slider(value: _amount, min: 500000, max: (product['maxAmount'] as int).toDouble(), divisions: 50,
            onChanged: (v) => setState(() => _amount = v)),
          const Divider(),
          _calcRow('Monthly Interest', '₦${(monthlyPayment / 100).toStringAsFixed(0)}'),
          _calcRow('Rate', '${product["rate"]}% p.a.'),
          _calcRow('Moratorium', product['moratorium'] as String),
          const SizedBox(height: 12),
          SizedBox(width: double.infinity, child: ElevatedButton(onPressed: () {}, style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo),
            child: const Text('Apply Now', style: TextStyle(color: Colors.white)))),
        ]))),
      ])),
    );
  }

  Widget _calcRow(String label, String value) {
    return Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(color: Colors.grey)), Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
    ]));
  }
}
