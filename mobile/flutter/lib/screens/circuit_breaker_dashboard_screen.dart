import 'package:flutter/material.dart';

class CircuitBreakerDashboardScreen extends StatefulWidget {
  const CircuitBreakerDashboardScreen({super.key});
  @override
  State<CircuitBreakerDashboardScreen> createState() => _CircuitBreakerDashboardScreenState();
}

class _CircuitBreakerDashboardScreenState extends State<CircuitBreakerDashboardScreen> {
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
      appBar: AppBar(title: const Text('Circuit Breaker Dashboard'), backgroundColor: Colors.green[700]),
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
            _kpi('Services', '512', Icons.dns),
            _kpi('Open', '0', Icons.error),
            _kpi('Half-Open', '2', Icons.warning),
            _kpi('Closed', '510', Icons.check_circle),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.payment, color: Colors.green),
              title: Text('payment-gateway'),
              subtitle: Text('Threshold: 5 failures/30s'),
              trailing: Text('Closed', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.person, color: Colors.green),
              title: Text('kyc-service'),
              subtitle: Text('Threshold: 3 failures/60s'),
              trailing: Text('Half-Open', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.sms, color: Colors.green),
              title: Text('sms-gateway'),
              subtitle: Text('Threshold: 10 failures/60s'),
              trailing: Text('Closed', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
