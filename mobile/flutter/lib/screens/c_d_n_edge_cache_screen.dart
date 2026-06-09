import 'package:flutter/material.dart';

class CDNEdgeCacheScreen extends StatefulWidget {
  const CDNEdgeCacheScreen({super.key});
  @override
  State<CDNEdgeCacheScreen> createState() => _CDNEdgeCacheScreenState();
}

class _CDNEdgeCacheScreenState extends State<CDNEdgeCacheScreen> {
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
      appBar: AppBar(title: const Text('CDN Edge Cache'), backgroundColor: Colors.green[700]),
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
            _kpi('Hit Rate', '94.5%', Icons.cached),
            _kpi('Bandwidth', '850Mbps', Icons.speed),
            _kpi('Edge Nodes', '12', Icons.dns),
            _kpi('Latency', '15ms', Icons.timer),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.image, color: Colors.green),
              title: Text('Static Assets'),
              subtitle: Text('JS/CSS/Images'),
              trailing: Text('24hr TTL', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.api, color: Colors.green),
              title: Text('API Cache'),
              subtitle: Text('GET responses'),
              trailing: Text('5min TTL', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.web, color: Colors.green),
              title: Text('HTML Pages'),
              subtitle: Text('Server-rendered'),
              trailing: Text('1min TTL', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
