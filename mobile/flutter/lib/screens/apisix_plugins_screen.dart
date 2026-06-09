import 'package:flutter/material.dart';

class ApisixPluginsScreen extends StatefulWidget {
  const ApisixPluginsScreen({super.key});
  @override
  State<ApisixPluginsScreen> createState() => _ApisixPluginsScreenState();
}

class _ApisixPluginsScreenState extends State<ApisixPluginsScreen> {
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
      appBar: AppBar(title: const Text('APISIX Plugins'), backgroundColor: Colors.green[700]),
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
            _kpi('Installed', '18', Icons.extension),
            _kpi('Custom', '4', Icons.code),
            _kpi('Enabled', '15', Icons.toggle_on),
            _kpi('Errors', '0', Icons.error),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.lock, color: Colors.green),
              title: Text('jwt-auth'),
              subtitle: Text('All routes'),
              trailing: Text('Enabled', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.speed, color: Colors.green),
              title: Text('limit-count'),
              subtitle: Text('API routes'),
              trailing: Text('Enabled', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.bar_chart, color: Colors.green),
              title: Text('prometheus'),
              subtitle: Text('Metrics'),
              trailing: Text('Enabled', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
