import 'package:flutter/material.dart';

class CbnAgsmeisScreen extends StatefulWidget {
  const CbnAgsmeisScreen({super.key});
  @override
  State<CbnAgsmeisScreen> createState() => _CbnAgsmeisScreenState();
}

class _CbnAgsmeisScreenState extends State<CbnAgsmeisScreen> {
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
      appBar: AppBar(title: const Text('CBN AGSMEIS'), backgroundColor: Colors.green[700]),
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
            _kpi('Loans Active', '4,500', Icons.credit_score),
            _kpi('Disbursed', '₦22.5B', Icons.payments),
            _kpi('Repayment', '87%', Icons.trending_up),
            _kpi('Default', '4.2%', Icons.warning),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.agriculture, color: Colors.green),
              title: Text('Agriculture'),
              subtitle: Text('45% of portfolio'),
              trailing: Text('₦10.1B', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.business, color: Colors.green),
              title: Text('SME'),
              subtitle: Text('35% of portfolio'),
              trailing: Text('₦7.9B', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.miscellaneous_services, color: Colors.green),
              title: Text('Services'),
              subtitle: Text('20% of portfolio'),
              trailing: Text('₦4.5B', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
