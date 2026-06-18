import 'package:flutter/material.dart';

class CreditFacilitiesScreen extends StatefulWidget {
  const CreditFacilitiesScreen({super.key});
  @override
  State<CreditFacilitiesScreen> createState() => _CreditFacilitiesScreenState();
}

class _CreditFacilitiesScreenState extends State<CreditFacilitiesScreen> {
  final List<Map<String, dynamic>> _facilities = [
    {'type': 'Overdraft', 'limit': 2000000, 'drawn': 500000, 'rate': 21.0, 'expiry': '2024-06-30', 'status': 'active'},
    {'type': 'Credit Card', 'limit': 5000000, 'drawn': 1200000, 'rate': 24.0, 'expiry': '2027-03-31', 'status': 'active'},
    {'type': 'Term Loan', 'limit': 10000000, 'drawn': 10000000, 'rate': 16.0, 'expiry': '2025-12-31', 'status': 'active'},
    {'type': 'Invoice Discounting', 'limit': 15000000, 'drawn': 0, 'rate': 12.5, 'expiry': '2024-09-30', 'status': 'available'},
    {'type': 'Bank Guarantee', 'limit': 20000000, 'drawn': 20000000, 'rate': 2.5, 'expiry': '2024-04-15', 'status': 'utilized'},
  ];

  @override
  Widget build(BuildContext context) {
    int totalLimit = _facilities.fold(0, (sum, f) => sum + (f['limit'] as int));
    int totalDrawn = _facilities.fold(0, (sum, f) => sum + (f['drawn'] as int));
    return Scaffold(
      appBar: AppBar(title: const Text('Credit Facilities')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          Card(color: Colors.blue.shade50, child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [
            Expanded(child: Column(children: [
              const Text('Total Limit', style: TextStyle(color: Colors.grey)),
              Text('\u20A6${(totalLimit / 100).toStringAsFixed(0)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ])),
            Expanded(child: Column(children: [
              const Text('Utilized', style: TextStyle(color: Colors.grey)),
              Text('\u20A6${(totalDrawn / 100).toStringAsFixed(0)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ])),
            Expanded(child: Column(children: [
              const Text('Available', style: TextStyle(color: Colors.grey)),
              Text('\u20A6${((totalLimit - totalDrawn) / 100).toStringAsFixed(0)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.green)),
            ])),
          ]))),
          const SizedBox(height: 16),
          ...List.generate(_facilities.length, (i) {
            final f = _facilities[i];
            double utilization = f['drawn'] / f['limit'];
            return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Text(f['type'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const Spacer(),
                  Chip(label: Text(f['status']), backgroundColor:
                    f['status'] == 'active' ? Colors.green.shade100
                    : f['status'] == 'available' ? Colors.blue.shade100 : Colors.orange.shade100),
                ]),
                const SizedBox(height: 8),
                LinearProgressIndicator(value: utilization, backgroundColor: Colors.grey.shade200,
                  color: utilization > 0.8 ? Colors.red : Colors.blue),
                const SizedBox(height: 4),
                Row(children: [
                  Text('\u20A6${(f["drawn"] / 100).toStringAsFixed(0)} / \u20A6${(f["limit"] / 100).toStringAsFixed(0)}'),
                  const Spacer(),
                  Text('${(utilization * 100).toStringAsFixed(0)}% used'),
                ]),
                const SizedBox(height: 4),
                Text('Rate: ${f["rate"]}% | Expires: ${f["expiry"]}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
              ],
            )));
          }),
        ]),
      ),
    );
  }
}
