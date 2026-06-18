import 'package:flutter/material.dart';

class BloomFilterCacheScreen extends StatefulWidget {
  const BloomFilterCacheScreen({super.key});
  @override
  State<BloomFilterCacheScreen> createState() => _BloomFilterCacheScreenState();
}

class _BloomFilterCacheScreenState extends State<BloomFilterCacheScreen> {
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
      appBar: AppBar(title: const Text('Bloom Filter Cache'), backgroundColor: Colors.green[700]),
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
            _kpi('Filter Size', '256MB', Icons.memory),
            _kpi('FP Rate', '0.01%', Icons.error),
            _kpi('Lookups/sec', '150K', Icons.search),
            _kpi('Hit Rate', '99.5%', Icons.cached),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.account_circle, color: Colors.green),
              title: Text('Account existence'),
              subtitle: Text('Check before DB query'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.fingerprint, color: Colors.green),
              title: Text('Transaction dedup'),
              subtitle: Text('Idempotency check'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
