import 'package:flutter/material.dart';

class BodyLimitEnforcerScreen extends StatefulWidget {
  const BodyLimitEnforcerScreen({super.key});
  @override
  State<BodyLimitEnforcerScreen> createState() => _BodyLimitEnforcerScreenState();
}

class _BodyLimitEnforcerScreenState extends State<BodyLimitEnforcerScreen> {
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
      appBar: AppBar(title: const Text('Body Limit Enforcer'), backgroundColor: Colors.green[700]),
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
            _kpi('Max Body', '10MB', Icons.upload),
            _kpi('Rejected', '45/hr', Icons.block),
            _kpi('Avg Size', '2.4KB', Icons.data_usage),
            _kpi('Peak', '8.5MB', Icons.trending_up),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.api, color: Colors.green),
              title: Text('API Requests'),
              subtitle: Text('1MB default limit'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.upload_file, color: Colors.green),
              title: Text('File Upload'),
              subtitle: Text('10MB limit'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.cloud_upload, color: Colors.green),
              title: Text('Bulk Import'),
              subtitle: Text('50MB limit'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
