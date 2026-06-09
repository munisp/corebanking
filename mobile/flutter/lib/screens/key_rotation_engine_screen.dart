import 'package:flutter/material.dart';

class KeyRotationEngineScreen extends StatefulWidget {
  const KeyRotationEngineScreen({super.key});
  @override
  State<KeyRotationEngineScreen> createState() => _KeyRotationEngineScreenState();
}

class _KeyRotationEngineScreenState extends State<KeyRotationEngineScreen> {
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
      appBar: AppBar(title: const Text('Key Rotation Engine'), backgroundColor: Colors.green[700]),
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
              _kpi('Keys', '125', Icons.vpn_key),
              _kpi('Rotations/mo', '45', Icons.sync),
              _kpi('Next', 'Feb 01', Icons.event),
              _kpi('PCI DSS', '4.0', Icons.verified),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Data Encryption Keys'),
              subtitle: Text('AES-256'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Monthly rotation', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Key Encryption Keys'),
              subtitle: Text('RSA-4096'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Quarterly', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('API Signing Keys'),
              subtitle: Text('ECDSA P-384'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Weekly', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('TLS Certificates'),
              subtitle: Text('Let's Encrypt'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Auto-renew 30d', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
