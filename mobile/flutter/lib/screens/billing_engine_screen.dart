import 'package:flutter/material.dart';

class BillingEngineScreen extends StatefulWidget {
  const BillingEngineScreen({super.key});
  @override
  State<BillingEngineScreen> createState() => _BillingEngineScreenState();
}

class _BillingEngineScreenState extends State<BillingEngineScreen> {
  final List<Map<String, dynamic>> _fees = [
    {'name': 'Monthly Maintenance', 'amount': 100, 'frequency': 'Monthly', 'lastCharged': '2024-01-01', 'waived': false},
    {'name': 'SMS Alert Fee', 'amount': 400, 'frequency': 'Monthly', 'lastCharged': '2024-01-01', 'waived': false},
    {'name': 'Card Issuance', 'amount': 100000, 'frequency': 'One-time', 'lastCharged': '2023-06-15', 'waived': false},
    {'name': 'Transfer Fee (>\u20A65K)', 'amount': 2650, 'frequency': 'Per txn', 'lastCharged': '2024-01-28', 'waived': false},
    {'name': 'ATM (other bank)', 'amount': 3500, 'frequency': 'Per txn', 'lastCharged': '2024-01-25', 'waived': false},
    {'name': 'Current Acct COT', 'amount': 0, 'frequency': 'Daily', 'lastCharged': 'N/A', 'waived': true},
  ];

  final Map<String, dynamic> _summary = {
    'totalFeesYTD': 45670, 'waivedYTD': 12000, 'stampDuty': 5000, 'vatOnFees': 3400,
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Fees & Charges')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [
            Expanded(child: Column(children: [
              const Text('Fees YTD', style: TextStyle(color: Colors.grey, fontSize: 12)),
              Text('\u20A6${(_summary["totalFeesYTD"] / 100).toStringAsFixed(2)}',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ])),
            Expanded(child: Column(children: [
              const Text('Waived', style: TextStyle(color: Colors.grey, fontSize: 12)),
              Text('\u20A6${(_summary["waivedYTD"] / 100).toStringAsFixed(2)}',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.green)),
            ])),
            Expanded(child: Column(children: [
              const Text('Stamp Duty', style: TextStyle(color: Colors.grey, fontSize: 12)),
              Text('\u20A6${(_summary["stampDuty"] / 100).toStringAsFixed(2)}',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ])),
          ]))),
          const SizedBox(height: 16),
          const Text('Fee Schedule', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ...List.generate(_fees.length, (i) {
            final f = _fees[i];
            return Card(child: ListTile(
              title: Text(f['name'], style: TextStyle(
                decoration: f['waived'] ? TextDecoration.lineThrough : null)),
              subtitle: Text('${f["frequency"]} | Last: ${f["lastCharged"]}'),
              trailing: f['waived']
                ? const Chip(label: Text('WAIVED', style: TextStyle(fontSize: 10)), backgroundColor: Colors.green)
                : Text('\u20A6${(f["amount"] / 100).toStringAsFixed(2)}',
                    style: const TextStyle(fontWeight: FontWeight.bold)),
            ));
          }),
          const SizedBox(height: 8),
          const Text('* CBN Guide to Bank Charges (2020) applies. VAT at 7.5% on eligible fees.',
            style: TextStyle(color: Colors.grey, fontSize: 11)),
        ]),
      ),
    );
  }
}
