import 'package:flutter/material.dart';

class AnomalyDetectorScreen extends StatefulWidget {
  const AnomalyDetectorScreen({super.key});
  @override
  State<AnomalyDetectorScreen> createState() => _AnomalyDetectorScreenState();
}

class _AnomalyDetectorScreenState extends State<AnomalyDetectorScreen> {
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
      appBar: AppBar(title: const Text('Anomaly Detector'), backgroundColor: Colors.green[700]),
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
            _kpi('Anomalies/hr', '3.2', Icons.bug_report),
            _kpi('Detection', '98.5%', Icons.search),
            _kpi('Response', '<200ms', Icons.timer),
            _kpi('Models', '12', Icons.psychology),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.devices, color: Colors.green),
              title: Text('Login pattern'),
              subtitle: Text('3 devices/10min'),
              trailing: Text('Blocked', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.trending_up, color: Colors.green),
              title: Text('Txn spike'),
              subtitle: Text('500% above baseline'),
              trailing: Text('Flagged', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
