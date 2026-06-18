import 'package:flutter/material.dart';

class BaselEngineScreen extends StatefulWidget {
  const BaselEngineScreen({super.key});
  @override
  State<BaselEngineScreen> createState() => _BaselEngineScreenState();
}

class _BaselEngineScreenState extends State<BaselEngineScreen> {
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
      appBar: AppBar(title: const Text('Basel III Engine'), backgroundColor: Colors.green[700]),
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
            _kpi('CAR', '16.2%', Icons.account_balance),
            _kpi('Tier 1', '14.5%', Icons.assessment),
            _kpi('LCR', '145%', Icons.water_drop),
            _kpi('NSFR', '112%', Icons.balance),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.credit_score, color: Colors.green),
              title: Text('Credit RWA'),
              subtitle: Text('₦245B risk-weighted'),
              trailing: Text('Within limit', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.show_chart, color: Colors.green),
              title: Text('Market RWA'),
              subtitle: Text('₦18B'),
              trailing: Text('Within limit', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.settings, color: Colors.green),
              title: Text('Op Risk RWA'),
              subtitle: Text('₦32B'),
              trailing: Text('Within limit', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
