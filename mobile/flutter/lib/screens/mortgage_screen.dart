import 'package:flutter/material.dart';

class MortgageScreen extends StatefulWidget {
  const MortgageScreen({super.key});
  @override
  State<MortgageScreen> createState() => _MortgageScreenState();
}

class _MortgageScreenState extends State<MortgageScreen> {
  double _propertyValue = 50000000;
  double _downPayment = 20;
  int _tenor = 20;
  double _rate = 12.5;

  double get _loanAmount => _propertyValue * (1 - _downPayment / 100);
  double get _monthlyRate => _rate / 100 / 12;
  int get _totalMonths => _tenor * 12;
  double get _monthlyPayment {
    if (_monthlyRate == 0) return _loanAmount / _totalMonths;
    double pow = 1;
    for (int i = 0; i < _totalMonths; i++) { pow *= (1 + _monthlyRate); }
    return _loanAmount * _monthlyRate * pow / (pow - 1);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mortgage'), backgroundColor: Colors.teal),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Card(color: Colors.teal, child: Padding(padding: const EdgeInsets.all(20), child: Column(children: [
          const Text('NHF Mortgage Calculator', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text('Monthly Payment: ₦${(_monthlyPayment / 100).toStringAsFixed(0)}', style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
          Text('Total: ₦${((_monthlyPayment * _totalMonths) / 100).toStringAsFixed(0)} over $_tenor years', style: const TextStyle(color: Colors.white70)),
        ]))),
        const SizedBox(height: 16),
        Text('Property Value: ₦${(_propertyValue / 1000000).toStringAsFixed(0)}M'),
        Slider(value: _propertyValue, min: 10000000, max: 200000000, divisions: 190, onChanged: (v) => setState(() => _propertyValue = v)),
        Text('Down Payment: ${_downPayment.toStringAsFixed(0)}% (₦${(_propertyValue * _downPayment / 100 / 1000000).toStringAsFixed(1)}M)'),
        Slider(value: _downPayment, min: 10, max: 50, divisions: 40, onChanged: (v) => setState(() => _downPayment = v)),
        Text('Tenor: $_tenor years'),
        Slider(value: _tenor.toDouble(), min: 5, max: 30, divisions: 25, onChanged: (v) => setState(() => _tenor = v.round())),
        Text('Interest Rate: ${_rate.toStringAsFixed(1)}% p.a.'),
        Slider(value: _rate, min: 6, max: 25, divisions: 38, onChanged: (v) => setState(() => _rate = v)),
        const SizedBox(height: 16),
        const Text('Mortgage Products', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        _productCard('NHF Mortgage', '6.0%', '30 years', 'National Housing Fund backed'),
        _productCard('Commercial Mortgage', '12.5%', '20 years', 'Standard bank mortgage'),
        _productCard('Diaspora Mortgage', '9.5%', '25 years', 'For Nigerians abroad'),
        _productCard('Construction Finance', '14.0%', '5 years', 'For building projects'),
      ])),
    );
  }

  Widget _productCard(String name, String rate, String tenor, String desc) {
    return Card(child: ListTile(leading: const Icon(Icons.home, color: Colors.teal),
      title: Text(name), subtitle: Text('$desc\nRate: $rate | Max tenor: $tenor'), isThreeLine: true,
      trailing: ElevatedButton(onPressed: () {}, child: const Text('Apply'))));
  }
}
