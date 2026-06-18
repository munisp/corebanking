import 'package:flutter/material.dart';

class CustomDomainScreen extends StatefulWidget {
  const CustomDomainScreen({super.key});
  @override
  State<CustomDomainScreen> createState() => _CustomDomainScreenState();
}

class _CustomDomainScreenState extends State<CustomDomainScreen> {
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
      appBar: AppBar(title: const Text('Custom Domain'), backgroundColor: Colors.green[700]),
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
            _kpi('Domains', '5', Icons.language),
            _kpi('SSL Certs', '5', Icons.security),
            _kpi('DNS Records', '24', Icons.dns),
            _kpi('CDN Enabled', '5', Icons.cached),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.public, color: Colors.green),
              title: Text('54bank.ng'),
              subtitle: Text('Primary domain'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.api, color: Colors.green),
              title: Text('api.54bank.ng'),
              subtitle: Text('API gateway'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.admin_panel_settings, color: Colors.green),
              title: Text('admin.54bank.ng'),
              subtitle: Text('Admin portal'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
