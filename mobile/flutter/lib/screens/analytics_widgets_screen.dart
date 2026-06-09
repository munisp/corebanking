import 'package:flutter/material.dart';

class AnalyticsWidgetsScreen extends StatefulWidget {
  const AnalyticsWidgetsScreen({super.key});
  @override
  State<AnalyticsWidgetsScreen> createState() => _AnalyticsWidgetsScreenState();
}

class _AnalyticsWidgetsScreenState extends State<AnalyticsWidgetsScreen> {
  String _period = 'Today';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Analytics'), actions: [
        DropdownButton<String>(value: _period, underline: const SizedBox(),
          items: ['Today', 'This Week', 'This Month', 'This Quarter'].map((p) => DropdownMenuItem(value: p, child: Text(p))).toList(),
          onChanged: (v) => setState(() => _period = v!)),
      ]),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(children: [
        Row(children: [
          Expanded(child: _metricCard('Transactions', '1.2M', '+8%', Colors.blue, Icons.swap_horiz)),
          Expanded(child: _metricCard('Volume', '₦89B', '+12%', Colors.green, Icons.trending_up)),
        ]),
        Row(children: [
          Expanded(child: _metricCard('Active Users', '456K', '+3%', Colors.orange, Icons.people)),
          Expanded(child: _metricCard('Avg TPS', '4,230', '+15%', Colors.purple, Icons.speed)),
        ]),
        const SizedBox(height: 16),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Channel Distribution', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          _channelRow('Mobile', 0.42, Colors.green),
          _channelRow('USSD', 0.28, Colors.orange),
          _channelRow('POS', 0.15, Colors.blue),
          _channelRow('ATM', 0.10, Colors.purple),
          _channelRow('Branch', 0.05, Colors.red),
        ]))),
        const SizedBox(height: 16),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Top Transaction Types', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          _txnTypeRow('Transfers', '450K', '₦32B'),
          _txnTypeRow('Airtime/Data', '320K', '₦2.1B'),
          _txnTypeRow('Bill Payments', '180K', '₦8.5B'),
          _txnTypeRow('Card Payments', '150K', '₦12B'),
          _txnTypeRow('Loan Disbursements', '5.2K', '₦34B'),
        ]))),
      ])),
    );
  }

  Widget _metricCard(String title, String value, String change, Color color, IconData icon) {
    return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [
      Icon(icon, color: color), Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
      Text(title, style: const TextStyle(fontSize: 11, color: Colors.grey)),
      Text(change, style: TextStyle(color: change.startsWith('+') ? Colors.green : Colors.red, fontSize: 12)),
    ])));
  }

  Widget _channelRow(String name, double value, Color color) {
    return Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
      SizedBox(width: 80, child: Text(name)), Expanded(child: LinearProgressIndicator(value: value, color: color, minHeight: 8)),
      const SizedBox(width: 8), Text('${(value * 100).toInt()}%'),
    ]));
  }

  Widget _txnTypeRow(String type, String count, String volume) {
    return ListTile(dense: true, title: Text(type), trailing: Text('$count txns | $volume'));
  }
}
