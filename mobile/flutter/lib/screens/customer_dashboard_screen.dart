import 'package:flutter/material.dart';

class CustomerDashboardScreen extends StatefulWidget {
  const CustomerDashboardScreen({super.key});
  @override
  State<CustomerDashboardScreen> createState() => _CustomerDashboardScreenState();
}

class _CustomerDashboardScreenState extends State<CustomerDashboardScreen> {
  final double _totalBalance = 13670000.00;
  final double _monthlyIncome = 2500000.00;
  final double _monthlyExpenses = 1850000.00;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Dashboard'), backgroundColor: Colors.green[700]),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Card(color: Colors.green[700], child: Padding(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Total Balance', style: TextStyle(color: Colors.white70, fontSize: 14)),
          Text('₦${(_totalBalance / 100).toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Row(children: [
            _balanceChip('Income', '+₦${(_monthlyIncome / 100).toStringAsFixed(0)}', Colors.green[300]!),
            const SizedBox(width: 12),
            _balanceChip('Expenses', '-₦${(_monthlyExpenses / 100).toStringAsFixed(0)}', Colors.red[300]!),
          ]),
        ]))),
        const SizedBox(height: 16),
        const Text('Quick Actions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        GridView.count(crossAxisCount: 4, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), children: [
          _quickAction(Icons.send, 'Transfer', Colors.blue),
          _quickAction(Icons.phone_android, 'Airtime', Colors.green),
          _quickAction(Icons.receipt, 'Bills', Colors.orange),
          _quickAction(Icons.qr_code, 'QR Pay', Colors.purple),
          _quickAction(Icons.savings, 'Save', Colors.teal),
          _quickAction(Icons.credit_card, 'Cards', Colors.red),
          _quickAction(Icons.account_balance, 'Loans', Colors.indigo),
          _quickAction(Icons.more_horiz, 'More', Colors.grey),
        ]),
        const SizedBox(height: 16),
        const Text('Recent Transactions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        _txnTile('Salary Credit - ABC Corp', '+₦1,500,000', 'Jan 14', true),
        _txnTile('Transfer to Chidinma', '-₦250,000', 'Jan 13', false),
        _txnTile('POS - Shoprite Ikeja', '-₦45,600', 'Jan 12', false),
        _txnTile('Airtime - MTN', '-₦5,000', 'Jan 11', false),
      ])),
    );
  }

  Widget _balanceChip(String label, String value, Color color) {
    return Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(20)),
      child: Text('$label: $value', style: TextStyle(color: color, fontWeight: FontWeight.bold)));
  }

  Widget _quickAction(IconData icon, String label, Color color) {
    return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      CircleAvatar(backgroundColor: color.withOpacity(0.1), child: Icon(icon, color: color)),
      const SizedBox(height: 4),
      Text(label, style: const TextStyle(fontSize: 11)),
    ]);
  }

  Widget _txnTile(String desc, String amount, String date, bool isCredit) {
    return ListTile(
      leading: CircleAvatar(backgroundColor: isCredit ? Colors.green[50] : Colors.red[50],
        child: Icon(isCredit ? Icons.arrow_downward : Icons.arrow_upward, color: isCredit ? Colors.green : Colors.red)),
      title: Text(desc), subtitle: Text(date),
      trailing: Text(amount, style: TextStyle(color: isCredit ? Colors.green : Colors.red, fontWeight: FontWeight.bold)),
    );
  }
}
