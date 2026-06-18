import 'package:flutter/material.dart';

class ApisixUpstreamsScreen extends StatefulWidget {
  const ApisixUpstreamsScreen({super.key});
  @override
  State<ApisixUpstreamsScreen> createState() => _ApisixUpstreamsScreenState();
}

class _ApisixUpstreamsScreenState extends State<ApisixUpstreamsScreen> {
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
      appBar: AppBar(title: const Text('APISIX Upstreams'), backgroundColor: Colors.green[700]),
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
            _kpi('Upstreams', '32', Icons.cloud),
            _kpi('Healthy', '31', Icons.check_circle),
            _kpi('Unhealthy', '1', Icons.error),
            _kpi('Avg Weight', '100', Icons.balance),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.dns, color: Colors.green),
              title: Text('core-banking-svc'),
              subtitle: Text('3 nodes, round-robin'),
              trailing: Text('Healthy', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.payment, color: Colors.green),
              title: Text('payment-gateway'),
              subtitle: Text('2 nodes, weighted'),
              trailing: Text('Healthy', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.warning, color: Colors.green),
              title: Text('kyc-service'),
              subtitle: Text('2 nodes'),
              trailing: Text('Degraded', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
