import 'package:flutter/material.dart';

class ContinuousLivenessScreen extends StatefulWidget {
  const ContinuousLivenessScreen({super.key});
  @override
  State<ContinuousLivenessScreen> createState() => _ContinuousLivenessScreenState();
}

class _ContinuousLivenessScreenState extends State<ContinuousLivenessScreen> {
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
      appBar: AppBar(title: const Text('Continuous Liveness'), backgroundColor: Colors.green[700]),
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
            _kpi('Active Sessions', '12K', Icons.people),
            _kpi('Checks/min', '720', Icons.camera),
            _kpi('Fraud Prevented', '23', Icons.block),
            _kpi('Accuracy', '99.5%', Icons.gps_fixed),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.face, color: Colors.green),
              title: Text('Face Match'),
              subtitle: Text('Every 5 min on high-risk'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.remove_red_eye, color: Colors.green),
              title: Text('Blink Detection'),
              subtitle: Text('Anti-spoofing'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
