import 'package:flutter/material.dart';

class ApiKeyEnforcerScreen extends StatefulWidget {
  const ApiKeyEnforcerScreen({super.key});
  @override
  State<ApiKeyEnforcerScreen> createState() => _ApiKeyEnforcerScreenState();
}

class _ApiKeyEnforcerScreenState extends State<ApiKeyEnforcerScreen> {
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
      appBar: AppBar(title: const Text('API Key Enforcer'), backgroundColor: Colors.green[700]),
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
            _kpi('Active Keys', '3,200', Icons.key),
            _kpi('Revoked', '23', Icons.block),
            _kpi('Expiring', '15', Icons.schedule),
            _kpi('Usage', '2.4M', Icons.bar_chart),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.phone_android, color: Colors.green),
              title: Text('Mobile App'),
              subtitle: Text('1.2M/day'),
              trailing: Text('Healthy', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.handshake, color: Colors.green),
              title: Text('Partner API'),
              subtitle: Text('800K/day'),
              trailing: Text('Healthy', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
