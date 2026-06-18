import 'package:flutter/material.dart';

class LoanOriginationScreen extends StatefulWidget {
  const LoanOriginationScreen({super.key});
  @override
  State<LoanOriginationScreen> createState() => _LoanOriginationScreenState();
}

class _LoanOriginationScreenState extends State<LoanOriginationScreen> {
  int _currentStep = 0;
  String _loanType = 'Personal';
  double _amount = 1000000;
  int _tenor = 12;
  double _rate = 18.5;

  final List<String> _loanTypes = ['Personal', 'Auto', 'Mortgage', 'SME', 'Agriculture', 'Education'];

  double get _monthlyPayment {
    double monthlyRate = _rate / 100 / 12;
    double pow = 1;
    for (int i = 0; i < _tenor; i++) { pow *= (1 + monthlyRate); }
    return _amount * monthlyRate * pow / (pow - 1);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Apply for Loan')),
      body: Stepper(
        currentStep: _currentStep,
        onStepContinue: () { if (_currentStep < 3) setState(() => _currentStep++); else _submitApplication(); },
        onStepCancel: () { if (_currentStep > 0) setState(() => _currentStep--); },
        steps: [
          Step(title: const Text('Loan Type'), isActive: _currentStep >= 0, content: Column(
            children: _loanTypes.map((t) => RadioListTile(
              title: Text(t), value: t, groupValue: _loanType,
              onChanged: (v) => setState(() => _loanType = v!),
            )).toList(),
          )),
          Step(title: const Text('Amount & Tenor'), isActive: _currentStep >= 1, content: Column(children: [
            Text('Amount: \u20A6${(_amount / 100).toStringAsFixed(0)}', style: const TextStyle(fontSize: 16)),
            Slider(min: 100000, max: 50000000, value: _amount, divisions: 499,
              onChanged: (v) => setState(() => _amount = v)),
            const SizedBox(height: 16),
            Text('Tenor: $_tenor months'),
            Slider(min: 3, max: 72, value: _tenor.toDouble(), divisions: 69,
              onChanged: (v) => setState(() => _tenor = v.round())),
            const SizedBox(height: 16),
            Card(color: Colors.blue.shade50, child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
              Text('Monthly Payment: \u20A6${(_monthlyPayment / 100).toStringAsFixed(2)}',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              Text('Rate: $_rate% p.a. | Total: \u20A6${((_monthlyPayment * _tenor) / 100).toStringAsFixed(0)}'),
            ]))),
          ])),
          Step(title: const Text('Documents'), isActive: _currentStep >= 2, content: Column(children: const [
            ListTile(leading: Icon(Icons.check_circle, color: Colors.green), title: Text('BVN Verified')),
            ListTile(leading: Icon(Icons.check_circle, color: Colors.green), title: Text('NIN Linked')),
            ListTile(leading: Icon(Icons.upload_file), title: Text('Upload payslip (last 3 months)')),
            ListTile(leading: Icon(Icons.upload_file), title: Text('Upload bank statement (6 months)')),
            ListTile(leading: Icon(Icons.upload_file), title: Text('Upload utility bill (address proof)')),
          ])),
          Step(title: const Text('Review'), isActive: _currentStep >= 3, content: Card(child: Padding(
            padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Loan Type: $_loanType'),
              Text('Amount: \u20A6${(_amount / 100).toStringAsFixed(0)}'),
              Text('Tenor: $_tenor months'),
              Text('Rate: $_rate% p.a.'),
              Text('Monthly: \u20A6${(_monthlyPayment / 100).toStringAsFixed(2)}'),
              const Divider(),
              const Text('By submitting, you agree to the loan terms and authorize a credit bureau check.',
                style: TextStyle(fontSize: 12, color: Colors.grey)),
            ]),
          ))),
        ],
      ),
    );
  }

  void _submitApplication() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Loan application submitted. Decision within 24 hours.')));
  }
}
