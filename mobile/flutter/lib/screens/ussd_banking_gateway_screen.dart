import 'package:flutter/material.dart';

/// USSD Banking Gateway — Admin dashboard for USSD session management and analytics
class UssdBankingGatewayScreen extends StatefulWidget {
  const UssdBankingGatewayScreen({super.key});
  @override
  State<UssdBankingGatewayScreen> createState() => _UssdBankingGatewayScreenState();
}

class _UssdBankingGatewayScreenState extends State<UssdBankingGatewayScreen> {
  final _sessions = [
    {'msisdn': '+2348012345678', 'code': '*919#', 'state': 'active', 'step': 'transfer_confirm', 'duration': '45s'},
    {'msisdn': '+2348098765432', 'code': '*919*1*50000*0123456789#', 'state': 'completed', 'step': 'done', 'duration': '23s'},
    {'msisdn': '+2347012345678', 'code': '*919#', 'state': 'timeout', 'step': 'pin_entry', 'duration': '120s'},
    {'msisdn': '+2349012345678', 'code': '*919*5000#', 'state': 'active', 'step': 'airtime_confirm', 'duration': '12s'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('USSD Gateway')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        // Stats
        Row(children: [
          _statCard('Active', '2,847', Colors.green),
          _statCard('Today', '45,231', Colors.blue),
          _statCard('Timeout', '3.2%', Colors.orange),
          _statCard('Errors', '0.1%', Colors.red),
        ].map((w) => Expanded(child: Padding(padding: const EdgeInsets.all(4), child: w))).toList()),
        const SizedBox(height: 16),
        // MNO breakdown
        const Text('MNO Distribution', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        _mnoBar('MTN', 0.45, Colors.amber),
        _mnoBar('Airtel', 0.28, Colors.red),
        _mnoBar('Glo', 0.18, Colors.green),
        _mnoBar('9mobile', 0.09, Colors.teal),
        const SizedBox(height: 16),
        // Live sessions
        const Text('Live Sessions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        ..._sessions.map((s) => Card(child: ListTile(
          leading: CircleAvatar(
            backgroundColor: s['state'] == 'active' ? Colors.green.shade50 : s['state'] == 'timeout' ? Colors.orange.shade50 : Colors.grey.shade100,
            child: Icon(Icons.dialpad, color: s['state'] == 'active' ? Colors.green : Colors.grey),
          ),
          title: Text(s['msisdn'] as String),
          subtitle: Text('${s["code"]} → ${s["step"]} (${s["duration"]})'),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: (s['state'] == 'active' ? Colors.green : s['state'] == 'timeout' ? Colors.orange : Colors.grey).withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text((s['state'] as String).toUpperCase(), style: TextStyle(fontSize: 10,
                color: s['state'] == 'active' ? Colors.green : s['state'] == 'timeout' ? Colors.orange : Colors.grey)),
          ),
        ))),
      ]),
    );
  }

  Widget _statCard(String label, String value, Color color) => Card(
    child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [
      Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
      Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
    ])),
  );

  Widget _mnoBar(String mno, double pct, Color color) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      SizedBox(width: 60, child: Text(mno)),
      Expanded(child: LinearProgressIndicator(value: pct, color: color, backgroundColor: Colors.grey.shade200)),
      const SizedBox(width: 8),
      Text('${(pct * 100).toInt()}%', style: const TextStyle(fontSize: 12)),
    ]),
  );
}
