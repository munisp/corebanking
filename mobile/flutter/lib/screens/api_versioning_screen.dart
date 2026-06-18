import 'package:flutter/material.dart';

class ApiVersioningScreen extends StatefulWidget {
  const ApiVersioningScreen({super.key});
  @override
  State<ApiVersioningScreen> createState() => _ApiVersioningScreenState();
}

class _ApiVersioningScreenState extends State<ApiVersioningScreen> {
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
      appBar: AppBar(title: const Text('API Versioning'), backgroundColor: Colors.green[700]),
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
            _kpi('Active Versions', '3', Icons.layers),
            _kpi('Deprecated', '1', Icons.warning),
            _kpi('Endpoints', '245', Icons.api),
            _kpi('Avg Latency', '35ms', Icons.speed),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.check_circle, color: Colors.green),
              title: Text('v3 (Current)'),
              subtitle: Text('245 endpoints'),
              trailing: Text('95% traffic', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.check, color: Colors.green),
              title: Text('v2 (Supported)'),
              subtitle: Text('230 endpoints'),
              trailing: Text('4.8% traffic', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.warning, color: Colors.green),
              title: Text('v1 (Deprecated)'),
              subtitle: Text('180 endpoints'),
              trailing: Text('0.2% traffic', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
