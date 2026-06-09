import 'package:flutter/material.dart';

class CreditBureauScreen extends StatefulWidget {
  const CreditBureauScreen({super.key});
  @override
  State<CreditBureauScreen> createState() => _CreditBureauScreenState();
}

class _CreditBureauScreenState extends State<CreditBureauScreen> {
  final Map<String, dynamic> _report = {
    'score': 720, 'maxScore': 850, 'bureau': 'CRC Credit Bureau',
    'lastUpdated': '2024-01-15', 'totalAccounts': 8, 'activeAccounts': 5,
    'totalDebt': 12500000, 'creditLimit': 25000000, 'utilization': 50,
    'enquiries30d': 2, 'defaults': 0, 'oldest_account_years': 7,
  };

  final List<Map<String, dynamic>> _accounts = [
    {'lender': 'Access Bank', 'type': 'Credit Card', 'limit': 5000000, 'balance': 1200000, 'status': 'current'},
    {'lender': 'GTBank', 'type': 'Personal Loan', 'limit': 3000000, 'balance': 2100000, 'status': 'current'},
    {'lender': 'FirstBank', 'type': 'Mortgage', 'limit': 35000000, 'balance': 32000000, 'status': 'current'},
    {'lender': 'Zenith Bank', 'type': 'Auto Loan', 'limit': 8500000, 'balance': 0, 'status': 'closed'},
    {'lender': 'UBA', 'type': 'Overdraft', 'limit': 2000000, 'balance': 500000, 'status': 'current'},
  ];

  @override
  Widget build(BuildContext context) {
    double scorePercent = _report['score'] / _report['maxScore'];
    return Scaffold(
      appBar: AppBar(title: const Text('Credit Bureau Report')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          Card(child: Padding(padding: const EdgeInsets.all(24), child: Column(children: [
            Stack(alignment: Alignment.center, children: [
              SizedBox(width: 120, height: 120, child: CircularProgressIndicator(
                value: scorePercent, strokeWidth: 10,
                backgroundColor: Colors.grey.shade200,
                color: scorePercent > 0.7 ? Colors.green : scorePercent > 0.5 ? Colors.orange : Colors.red,
              )),
              Column(children: [
                Text('${_report["score"]}', style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold)),
                Text('/ ${_report["maxScore"]}', style: const TextStyle(color: Colors.grey)),
              ]),
            ]),
            const SizedBox(height: 16),
            Text(_report['bureau'], style: const TextStyle(color: Colors.grey)),
            Text('Last updated: ${_report["lastUpdated"]}'),
          ]))),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: _infoTile('Utilization', '${_report["utilization"]}%')),
            Expanded(child: _infoTile('Defaults', '${_report["defaults"]}')),
            Expanded(child: _infoTile('Enquiries', '${_report["enquiries30d"]}')),
            Expanded(child: _infoTile('History', '${_report["oldest_account_years"]}yr')),
          ]),
          const SizedBox(height: 24),
          const Align(alignment: Alignment.centerLeft,
            child: Text('Credit Accounts', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold))),
          const SizedBox(height: 8),
          ...List.generate(_accounts.length, (i) {
            final a = _accounts[i];
            return Card(child: ListTile(
              title: Text('${a["lender"]} - ${a["type"]}'),
              subtitle: Text('Balance: \u20A6${(a["balance"] / 100).toStringAsFixed(0)} / Limit: \u20A6${(a["limit"] / 100).toStringAsFixed(0)}'),
              trailing: Chip(label: Text(a['status']),
                backgroundColor: a['status'] == 'current' ? Colors.green.shade100 : Colors.grey.shade200),
            ));
          }),
        ]),
      ),
    );
  }

  Widget _infoTile(String label, String value) => Card(child: Padding(
    padding: const EdgeInsets.all(12),
    child: Column(children: [
      Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
    ]),
  ));
}
