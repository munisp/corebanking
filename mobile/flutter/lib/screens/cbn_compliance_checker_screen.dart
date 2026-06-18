import 'package:flutter/material.dart';

class CbnComplianceCheckerScreen extends StatefulWidget {
  const CbnComplianceCheckerScreen({super.key});
  @override
  State<CbnComplianceCheckerScreen> createState() => _CbnComplianceCheckerScreenState();
}

class _CbnComplianceCheckerScreenState extends State<CbnComplianceCheckerScreen> {
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
      appBar: AppBar(title: const Text('CBN Compliance Checker'), backgroundColor: Colors.green[700]),
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
            _kpi('Rules', '156', Icons.gavel),
            _kpi('Compliant', '148', Icons.check_circle),
            _kpi('Warnings', '6', Icons.warning),
            _kpi('Violations', '2', Icons.error),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.account_balance, color: Colors.green),
              title: Text('Capital Adequacy'),
              subtitle: Text('CAR 16.2% (min 15%)'),
              trailing: Text('Pass', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.water_drop, color: Colors.green),
              title: Text('Liquidity Ratio'),
              subtitle: Text('LR 35% (min 30%)'),
              trailing: Text('Pass', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.warning, color: Colors.green),
              title: Text('NPL Ratio'),
              subtitle: Text('4.8% (max 5%)'),
              trailing: Text('Warning', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
