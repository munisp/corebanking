import 'package:flutter/material.dart';

class APISIXPluginOptimizerScreen extends StatefulWidget {
  const APISIXPluginOptimizerScreen({super.key});
  @override
  State<APISIXPluginOptimizerScreen> createState() => _APISIXPluginOptimizerScreenState();
}

class _APISIXPluginOptimizerScreenState extends State<APISIXPluginOptimizerScreen> {
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
      appBar: AppBar(title: const Text('APISIX Plugin Optimizer'), backgroundColor: Colors.green[700]),
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
            _kpi('Plugins', '24', Icons.extension),
            _kpi('Latency', '12ms', Icons.speed),
            _kpi('Error Rate', '0.02%', Icons.error_outline),
            _kpi('Cache Hit', '94.5%', Icons.cached),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.lock, color: Colors.green),
              title: Text('jwt-auth'),
              subtitle: Text('Authentication'),
              trailing: Text('3ms', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.speed, color: Colors.green),
              title: Text('rate-limiting'),
              subtitle: Text('Traffic'),
              trailing: Text('1ms', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.public, color: Colors.green),
              title: Text('cors'),
              subtitle: Text('Cross-origin'),
              trailing: Text('<1ms', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
