import 'package:flutter/material.dart';

class KycSelfServiceScreen extends StatefulWidget {
  const KycSelfServiceScreen({super.key});
  @override
  State<KycSelfServiceScreen> createState() => _KycSelfServiceScreenState();
}

class _KycSelfServiceScreenState extends State<KycSelfServiceScreen> {
  final Map<String, dynamic> _kycStatus = {
    'tier': 2, 'maxTier': 3,
    'bvn': true, 'nin': true, 'address': true, 'selfie': false, 'liveness': false, 'utility_bill': true,
  };

  final List<Map<String, dynamic>> _tierLimits = [
    {'tier': 1, 'singleDebit': 50000, 'dailyDebit': 200000, 'balance': 300000},
    {'tier': 2, 'singleDebit': 200000, 'dailyDebit': 500000, 'balance': 5000000},
    {'tier': 3, 'singleDebit': 5000000, 'dailyDebit': 'Unlimited', 'balance': 'Unlimited'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('KYC Self-Service')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Card(color: Colors.blue.shade50, child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [
            CircleAvatar(radius: 30, backgroundColor: Colors.blue,
              child: Text('T${_kycStatus["tier"]}', style: const TextStyle(color: Colors.white, fontSize: 20))),
            const SizedBox(width: 16),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Current: Tier ${_kycStatus["tier"]}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const Text('Complete selfie + liveness for Tier 3'),
              LinearProgressIndicator(value: _kycStatus['tier'] / _kycStatus['maxTier']),
            ])),
          ]))),
          const SizedBox(height: 16),
          const Text('Verification Status', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          _verifyItem('BVN Verification', _kycStatus['bvn']),
          _verifyItem('NIN Linked', _kycStatus['nin']),
          _verifyItem('Address Verified', _kycStatus['address']),
          _verifyItem('Utility Bill', _kycStatus['utility_bill']),
          _verifyItem('Selfie Capture', _kycStatus['selfie']),
          _verifyItem('Liveness Detection', _kycStatus['liveness']),
          const SizedBox(height: 24),
          const Text('Tier Limits (CBN)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          DataTable(columns: const [
            DataColumn(label: Text('Tier')), DataColumn(label: Text('Single')),
            DataColumn(label: Text('Daily')), DataColumn(label: Text('Balance')),
          ], rows: _tierLimits.map((t) => DataRow(
            selected: t['tier'] == _kycStatus['tier'],
            cells: [
              DataCell(Text('${t["tier"]}')),
              DataCell(Text(t['singleDebit'] is int ? '\u20A6${t["singleDebit"] ~/ 100}' : t['singleDebit'])),
              DataCell(Text(t['dailyDebit'] is int ? '\u20A6${t["dailyDebit"] ~/ 100}' : t['dailyDebit'])),
              DataCell(Text(t['balance'] is int ? '\u20A6${t["balance"] ~/ 100}' : t['balance'])),
            ],
          )).toList()),
          const SizedBox(height: 24),
          SizedBox(width: double.infinity, child: ElevatedButton.icon(
            icon: const Icon(Icons.camera_alt),
            label: const Text('Complete Selfie + Liveness (Upgrade to Tier 3)'),
            onPressed: () {},
          )),
        ]),
      ),
    );
  }

  Widget _verifyItem(String label, bool done) => ListTile(
    leading: Icon(done ? Icons.check_circle : Icons.radio_button_unchecked,
      color: done ? Colors.green : Colors.grey),
    title: Text(label),
    trailing: done ? null : TextButton(onPressed: () {}, child: const Text('Complete')),
  );
}
