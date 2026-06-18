import 'package:flutter/material.dart';

class BundleSplitterScreen extends StatefulWidget {
  const BundleSplitterScreen({super.key});
  @override
  State<BundleSplitterScreen> createState() => _BundleSplitterScreenState();
}

class _BundleSplitterScreenState extends State<BundleSplitterScreen> {
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
      appBar: AppBar(title: const Text('Bundle Splitter'), backgroundColor: Colors.green[700]),
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
            _kpi('Total Size', '2.4MB', Icons.folder),
            _kpi('Chunks', '24', Icons.grid_view),
            _kpi('Lazy Load', '18', Icons.download),
            _kpi('Initial', '380KB', Icons.speed),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.code, color: Colors.green),
              title: Text('Core bundle'),
              subtitle: Text('Framework + routing'),
              trailing: Text('380KB', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.account_balance, color: Colors.green),
              title: Text('Banking module'),
              subtitle: Text('Transactions + accounts'),
              trailing: Text('420KB', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.admin_panel_settings, color: Colors.green),
              title: Text('Admin module'),
              subtitle: Text('Dashboards + reports'),
              trailing: Text('280KB', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
