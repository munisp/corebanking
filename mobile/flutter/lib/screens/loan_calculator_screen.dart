import 'package:flutter/material.dart';

class LoanCalculatorScreen extends StatefulWidget {
  const LoanCalculatorScreen({super.key});
  @override
  State<LoanCalculatorScreen> createState() => _LoanCalculatorScreenState();
}

class _LoanCalculatorScreenState extends State<LoanCalculatorScreen> {
  double _amount = 2000000;
  double _rate = 18.5;
  int _tenor = 12;

  double get _monthlyRate => _rate / 100 / 12;
  double get _monthlyPayment {
    if (_monthlyRate == 0) return _amount / _tenor;
    double pow = 1;
    for (int i = 0; i < _tenor; i++) { pow *= (1 + _monthlyRate); }
    return _amount * _monthlyRate * pow / (pow - 1);
  }
  double get _totalPayment => _monthlyPayment * _tenor;
  double get _totalInterest => _totalPayment - _amount;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Loan Calculator')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Card(color: Colors.blue.shade50, child: Padding(padding: const EdgeInsets.all(20), child: Column(children: [
            const Text('Monthly Payment', style: TextStyle(color: Colors.grey)),
            Text('\u20A6${(_monthlyPayment / 100).toStringAsFixed(2)}',
              style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.blue)),
          ]))),
          const SizedBox(height: 24),
          Text('Loan Amount: \u20A6${(_amount / 100).toStringAsFixed(0)}'),
          Slider(min: 100000, max: 100000000, value: _amount, divisions: 999,
            onChanged: (v) => setState(() => _amount = v)),
          const SizedBox(height: 16),
          Text('Interest Rate: ${_rate.toStringAsFixed(1)}% p.a.'),
          Slider(min: 5, max: 40, value: _rate, divisions: 70,
            onChanged: (v) => setState(() => _rate = v)),
          const SizedBox(height: 16),
          Text('Tenor: $_tenor months'),
          Slider(min: 1, max: 360, value: _tenor.toDouble(), divisions: 359,
            onChanged: (v) => setState(() => _tenor = v.round())),
          const SizedBox(height: 24),
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
            _summaryRow('Principal', '\u20A6${(_amount / 100).toStringAsFixed(0)}'),
            _summaryRow('Total Interest', '\u20A6${(_totalInterest / 100).toStringAsFixed(0)}'),
            const Divider(),
            _summaryRow('Total Repayment', '\u20A6${(_totalPayment / 100).toStringAsFixed(0)}'),
            _summaryRow('Effective Rate', '${((_totalInterest / _amount) * 100).toStringAsFixed(1)}%'),
          ]))),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: () {}, child: const Text('Apply for This Loan'))),
        ]),
      ),
    );
  }

  Widget _summaryRow(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      Text(label, style: const TextStyle(color: Colors.grey)),
      const Spacer(),
      Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
    ]),
  );
}
