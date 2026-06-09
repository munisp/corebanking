import 'package:flutter/material.dart';

class AdaptiveRateLimiterScreen extends StatefulWidget {
  const AdaptiveRateLimiterScreen({super.key});
  @override
  State<AdaptiveRateLimiterScreen> createState() => _AdaptiveRateLimiterScreenState();
}

class _AdaptiveRateLimiterScreenState extends State<AdaptiveRateLimiterScreen> {
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
      appBar: AppBar(title: const Text('Adaptive Rate Limiter'), backgroundColor: Colors.green[700]),
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
            _kpi('Req/sec', '12,450', Icons.speed),
            _kpi('Throttled', '0.3%', Icons.block),
            _kpi('Burst', '50K', Icons.flash_on),
            _kpi('Avg Resp', '45ms', Icons.timer),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.swap_horiz, color: Colors.green),
              title: Text('Transfer API'),
              subtitle: Text('100/min per user'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.account_balance, color: Colors.green),
              title: Text('Balance API'),
              subtitle: Text('300/min per user'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.login, color: Colors.green),
              title: Text('Login'),
              subtitle: Text('10/min per IP'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
