import 'package:flutter/material.dart';

class ExpenseMgmtScreen extends StatefulWidget {
  const ExpenseMgmtScreen({super.key});
  @override
  State<ExpenseMgmtScreen> createState() => _ExpenseMgmtScreenState();
}

class _ExpenseMgmtScreenState extends State<ExpenseMgmtScreen> {
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
      appBar: AppBar(title: const Text('Expense Mgmt'), backgroundColor: Colors.green[700]),
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
              _kpi('OPEX Budget', '₦85B', Icons.money),
              _kpi('Spent YTD', '₦52B', Icons.trending_up),
              _kpi('Cost/Income', '48.5%', Icons.percent),
              _kpi('Savings', '₦3.2B', Icons.savings),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Staff Costs'),
              subtitle: Text('Personnel'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦28B (54%)', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('On Budget', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Technology & IT'),
              subtitle: Text('Infrastructure'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦12B (23%)', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('On Budget', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Premises & Equipment'),
              subtitle: Text('Occupancy'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦5.8B (11%)', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('On Budget', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Marketing & Brand'),
              subtitle: Text('Business Dev'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦3.5B (7%)', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Under Budget', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
