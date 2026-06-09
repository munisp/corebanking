import 'package:flutter/material.dart';

class SecretsRotationScreen extends StatefulWidget {
  const SecretsRotationScreen({super.key});
  @override
  State<SecretsRotationScreen> createState() => _SecretsRotationScreenState();
}

class _SecretsRotationScreenState extends State<SecretsRotationScreen> {
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
      appBar: AppBar(title: const Text('Secrets Rotation'), backgroundColor: Colors.green[700]),
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
              _kpi('Secrets', '350', Icons.vpn_key),
              _kpi('Auto-rotated', '100%', Icons.sync),
              _kpi('Next Rotation', 'Feb 01', Icons.event),
              _kpi('Vault', 'HashiCorp', Icons.lock),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('DB Passwords'),
              subtitle: Text('Dynamic'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('24hr TTL, auto-rotate', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('API Keys'),
              subtitle: Text('KV v2'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('90d rotation', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('JWT Signing Keys'),
              subtitle: Text('RSA-4096'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Weekly rotation', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('TLS Certs'),
              subtitle: Text('cert-manager'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('30d auto-renew', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
