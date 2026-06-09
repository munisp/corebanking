import 'package:flutter/material.dart';

class CacheInvalidationScreen extends StatefulWidget {
  const CacheInvalidationScreen({super.key});
  @override
  State<CacheInvalidationScreen> createState() => _CacheInvalidationScreenState();
}

class _CacheInvalidationScreenState extends State<CacheInvalidationScreen> {
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
      appBar: AppBar(title: const Text('Cache Invalidation'), backgroundColor: Colors.green[700]),
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
            _kpi('Keys', '1.2M', Icons.key),
            _kpi('Evictions/min', '450', Icons.delete),
            _kpi('Hit Rate', '96.8%', Icons.cached),
            _kpi('Memory', '4.2GB', Icons.memory),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.account_balance, color: Colors.green),
              title: Text('Account Balance'),
              subtitle: Text('Invalidate on txn'),
              trailing: Text('Event-driven', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.person, color: Colors.green),
              title: Text('Customer Profile'),
              subtitle: Text('TTL 5min'),
              trailing: Text('Time-based', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.percent, color: Colors.green),
              title: Text('Rate Cards'),
              subtitle: Text('Admin update'),
              trailing: Text('Manual', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
