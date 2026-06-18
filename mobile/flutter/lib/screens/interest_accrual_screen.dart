import 'package:flutter/material.dart';

class InterestAccrualScreen extends StatefulWidget {
  const InterestAccrualScreen({super.key});
  @override
  State<InterestAccrualScreen> createState() => _InterestAccrualScreenState();
}

class _InterestAccrualScreenState extends State<InterestAccrualScreen> {
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
      appBar: AppBar(title: const Text('Interest Accrual'), backgroundColor: Colors.green[700]),
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
              _kpi('Daily Accrual', '₦2.8B', Icons.calculate),
              _kpi('Month-to-Date', '₦45B', Icons.calendar_month),
              _kpi('Loan Interest', '₦38B', Icons.trending_up),
              _kpi('Deposit Interest', '₦22B', Icons.trending_down),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Commercial Loan Accrual'),
              subtitle: Text('Daily (ACT/365)'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦1.5B/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Posted', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Mortgage Interest Accrual'),
              subtitle: Text('Monthly (30/360)'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦450M/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Posted', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Savings Deposit Accrual'),
              subtitle: Text('Daily (ACT/365)'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦280M/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Posted', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('FD Interest Accrual'),
              subtitle: Text('Maturity (ACT/365)'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦850M/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Posted', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
