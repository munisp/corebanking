import 'package:flutter/material.dart';

class ChangelogGeneratorScreen extends StatefulWidget {
  const ChangelogGeneratorScreen({super.key});
  @override
  State<ChangelogGeneratorScreen> createState() => _ChangelogGeneratorScreenState();
}

class _ChangelogGeneratorScreenState extends State<ChangelogGeneratorScreen> {
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
      appBar: AppBar(title: const Text('Changelog Generator'), backgroundColor: Colors.green[700]),
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
            _kpi('Releases', '45', Icons.new_releases),
            _kpi('This Month', '3', Icons.calendar_today),
            _kpi('Contributors', '24', Icons.people),
            _kpi('Commits', '12,800', Icons.commit),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.bug_report, color: Colors.green),
              title: Text('v3.2.1'),
              subtitle: Text('Bug fixes + security patches'),
              trailing: Text('2024-01-15', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.payment, color: Colors.green),
              title: Text('v3.2.0'),
              subtitle: Text('New payment features'),
              trailing: Text('2024-01-10', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
