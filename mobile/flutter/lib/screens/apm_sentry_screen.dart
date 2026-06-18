import 'package:flutter/material.dart';

class ApmSentryScreen extends StatefulWidget {
  const ApmSentryScreen({super.key});
  @override
  State<ApmSentryScreen> createState() => _ApmSentryScreenState();
}

class _ApmSentryScreenState extends State<ApmSentryScreen> {
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
      appBar: AppBar(title: const Text('APM & Sentry'), backgroundColor: Colors.green[700]),
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
            _kpi('Error Rate', '0.12%', Icons.error),
            _kpi('P95 Latency', '250ms', Icons.timer),
            _kpi('Apdex', '0.94', Icons.speed),
            _kpi('Events/hr', '1.2K', Icons.event),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.bug_report, color: Colors.green),
              title: Text('TypeError: null ref'),
              subtitle: Text('payment-service 45/hr'),
              trailing: Text('Critical', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.schedule, color: Colors.green),
              title: Text('TimeoutError'),
              subtitle: Text('kyc-verify 12/hr'),
              trailing: Text('Warning', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
