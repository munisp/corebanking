import 'package:flutter/material.dart';

class IntegrationTestsScreen extends StatefulWidget {
  const IntegrationTestsScreen({super.key});
  @override
  State<IntegrationTestsScreen> createState() => _IntegrationTestsScreenState();
}

class _IntegrationTestsScreenState extends State<IntegrationTestsScreen> {
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
      appBar: AppBar(title: const Text('Integration Tests'), backgroundColor: Colors.green[700]),
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
              _kpi('Test Suites', '125', Icons.integration_instructions),
              _kpi('Total Tests', '4,500', Icons.science),
              _kpi('Pass Rate', '97.8%', Icons.check),
              _kpi('Avg Runtime', '25 min', Icons.timer),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Transfer E2E Suite'),
              subtitle: Text('12 tests'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('NIP+NEFT+RTGS', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passing', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('KYC Verification Suite'),
              subtitle: Text('8 tests'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('BVN+NIN+Liveness', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passing', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Card Operations Suite'),
              subtitle: Text('15 tests'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Issue+Activate+Block', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passing', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Settlement Suite'),
              subtitle: Text('6 tests'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('NIBSS+Mojaloop', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passing', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
