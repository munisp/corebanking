import 'package:flutter/material.dart';

class ArtAdversarialScreen extends StatefulWidget {
  const ArtAdversarialScreen({super.key});
  @override
  State<ArtAdversarialScreen> createState() => _ArtAdversarialScreenState();
}

class _ArtAdversarialScreenState extends State<ArtAdversarialScreen> {
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
      appBar: AppBar(title: const Text('Adversarial Testing'), backgroundColor: Colors.green[700]),
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
            _kpi('Tests Run', '1,245', Icons.security),
            _kpi('Vulns Found', '3', Icons.bug_report),
            _kpi('Pass Rate', '99.8%', Icons.check_circle),
            _kpi('Coverage', '94%', Icons.coverage),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.shield, color: Colors.green),
              title: Text('SQL Injection'),
              subtitle: Text('All endpoints'),
              trailing: Text('Pass', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.code, color: Colors.green),
              title: Text('XSS'),
              subtitle: Text('Input fields'),
              trailing: Text('Pass', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.lock, color: Colors.green),
              title: Text('CSRF'),
              subtitle: Text('State-changing ops'),
              trailing: Text('Pass', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
