import 'package:flutter/material.dart';

class BandwidthAdaptationScreen extends StatefulWidget {
  const BandwidthAdaptationScreen({super.key});
  @override
  State<BandwidthAdaptationScreen> createState() => _BandwidthAdaptationScreenState();
}

class _BandwidthAdaptationScreenState extends State<BandwidthAdaptationScreen> {
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
      appBar: AppBar(title: const Text('Bandwidth Adaptation'), backgroundColor: Colors.green[700]),
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
            _kpi('Current BW', '850Mbps', Icons.speed),
            _kpi('Peak', '1.2Gbps', Icons.trending_up),
            _kpi('Compression', '65%', Icons.compress),
            _kpi('CDN Hit', '92%', Icons.cached),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.api, color: Colors.green),
              title: Text('API Responses'),
              subtitle: Text('gzip + brotli'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.image, color: Colors.green),
              title: Text('Image Optimization'),
              subtitle: Text('WebP conversion'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.download, color: Colors.green),
              title: Text('Lazy Loading'),
              subtitle: Text('Below-fold content'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
