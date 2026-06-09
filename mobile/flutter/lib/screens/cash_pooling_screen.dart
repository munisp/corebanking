import 'package:flutter/material.dart';

class CashPoolingScreen extends StatefulWidget {
  const CashPoolingScreen({super.key});
  @override
  State<CashPoolingScreen> createState() => _CashPoolingScreenState();
}

class _CashPoolingScreenState extends State<CashPoolingScreen> {
  bool _isLoading = false;

  Widget _kpi(String label, String value, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Colors.green[700], size: 20),
            const Spacer(),
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cash Pooling'), backgroundColor: Colors.green[700]),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.6,
              children: [
            _kpi('Pool Balance', '₦15.8B', Icons.account_balance),
            _kpi('Accounts', '245', Icons.layers),
            _kpi('Sweep Rate', 'Daily', Icons.sync),
            _kpi('Interest', '8.5% p.a.', Icons.percent),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.account_balance_wallet, color: Colors.green),
              title: Text('Header Account'),
              subtitle: Text('Corporate master'),
              trailing: Text('₦15.8B', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.sync, color: Colors.green),
              title: Text('Auto Sweep'),
              subtitle: Text('Sub→Header at EOD'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.percent, color: Colors.green),
              title: Text('Interest Allocation'),
              subtitle: Text('Pro-rata'),
              trailing: Text('Daily', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
