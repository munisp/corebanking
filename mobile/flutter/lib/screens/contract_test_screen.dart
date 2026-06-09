import 'package:flutter/material.dart';

class ContractTestScreen extends StatefulWidget {
  const ContractTestScreen({super.key});
  @override
  State<ContractTestScreen> createState() => _ContractTestScreenState();
}

class _ContractTestScreenState extends State<ContractTestScreen> {
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
      appBar: AppBar(title: const Text('Contract Testing'), backgroundColor: Colors.green[700]),
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
            _kpi('Contracts', '89', Icons.description),
            _kpi('Passing', '87', Icons.check_circle),
            _kpi('Failing', '2', Icons.error),
            _kpi('Coverage', '94%', Icons.pie_chart),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.payment, color: Colors.green),
              title: Text('Payment API'),
              subtitle: Text('v3 schema validated'),
              trailing: Text('Pass', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.person, color: Colors.green),
              title: Text('KYC API'),
              subtitle: Text('Response shape verified'),
              trailing: Text('Pass', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.credit_card, color: Colors.green),
              title: Text('Card API'),
              subtitle: Text('Breaking change detected'),
              trailing: Text('Fail', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
