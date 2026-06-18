import 'package:flutter/material.dart';

class CustomerInsightsScreen extends StatefulWidget {
  const CustomerInsightsScreen({super.key});
  @override
  State<CustomerInsightsScreen> createState() => _CustomerInsightsScreenState();
}

class _CustomerInsightsScreenState extends State<CustomerInsightsScreen> {
  String _period = 'This Month';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Customer Insights'), actions: [
        DropdownButton<String>(value: _period, underline: const SizedBox(),
          items: ['This Week', 'This Month', 'This Quarter', 'This Year'].map((p) => DropdownMenuItem(value: p, child: Text(p))).toList(),
          onChanged: (v) => setState(() => _period = v!)),
      ]),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(children: [
        Row(children: [
          Expanded(child: _insightCard('New Accounts', '2,340', '+12%', Colors.green, Icons.person_add)),
          Expanded(child: _insightCard('Closed Accounts', '156', '-8%', Colors.red, Icons.person_remove)),
        ]),
        Row(children: [
          Expanded(child: _insightCard('Avg Balance', '₦1.8M', '+5%', Colors.blue, Icons.account_balance_wallet)),
          Expanded(child: _insightCard('NPS Score', '72', '+3', Colors.purple, Icons.thumb_up)),
        ]),
        const SizedBox(height: 16),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Channel Usage', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          _channelBar('Mobile App', 0.68, Colors.green),
          _channelBar('USSD', 0.22, Colors.orange),
          _channelBar('Internet Banking', 0.15, Colors.blue),
          _channelBar('Branch', 0.08, Colors.purple),
          _channelBar('ATM', 0.42, Colors.teal),
          _channelBar('POS', 0.35, Colors.red),
        ]))),
        const SizedBox(height: 16),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Top Products by Uptake', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          _productRow('Savings Account', '89%', Colors.green),
          _productRow('Debit Card', '76%', Colors.blue),
          _productRow('Mobile Banking', '68%', Colors.orange),
          _productRow('Fixed Deposit', '23%', Colors.purple),
          _productRow('Personal Loan', '15%', Colors.red),
        ]))),
      ])),
    );
  }

  Widget _insightCard(String title, String value, String change, Color color, IconData icon) {
    final isPositive = change.startsWith('+');
    return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, color: color), const SizedBox(height: 8),
      Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
      Text(title, style: const TextStyle(fontSize: 12, color: Colors.grey)),
      Text(change, style: TextStyle(fontSize: 12, color: isPositive ? Colors.green : Colors.red)),
    ])));
  }

  Widget _channelBar(String label, double value, Color color) {
    return Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
      SizedBox(width: 120, child: Text(label)),
      Expanded(child: LinearProgressIndicator(value: value, backgroundColor: Colors.grey[200], color: color, minHeight: 10)),
      const SizedBox(width: 8),
      Text('${(value * 100).toInt()}%'),
    ]));
  }

  Widget _productRow(String product, String uptake, Color color) {
    return ListTile(dense: true, leading: Icon(Icons.circle, color: color, size: 12), title: Text(product), trailing: Text(uptake, style: TextStyle(fontWeight: FontWeight.bold, color: color)));
  }
}
