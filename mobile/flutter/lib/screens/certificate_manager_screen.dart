import 'package:flutter/material.dart';

class CertificateManagerScreen extends StatefulWidget {
  const CertificateManagerScreen({super.key});
  @override
  State<CertificateManagerScreen> createState() => _CertificateManagerScreenState();
}

class _CertificateManagerScreenState extends State<CertificateManagerScreen> {
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
      appBar: AppBar(title: const Text('Certificate Manager'), backgroundColor: Colors.green[700]),
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
            _kpi('Active Certs', '24', Icons.security),
            _kpi('Expiring', '2', Icons.schedule),
            _kpi('Auto-Renew', '20', Icons.autorenew),
            _kpi('OCSP Valid', '24', Icons.check),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.lock, color: Colors.green),
              title: Text('*.54bank.ng'),
              subtitle: Text('Wildcard SSL, expires 2025-06'),
              trailing: Text('Valid', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.verified_user, color: Colors.green),
              title: Text('api.54bank.ng'),
              subtitle: Text('EV SSL, expires 2025-03'),
              trailing: Text('Valid', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
