import 'package:flutter/material.dart';

class CloudKmsBridgeScreen extends StatefulWidget {
  const CloudKmsBridgeScreen({super.key});
  @override
  State<CloudKmsBridgeScreen> createState() => _CloudKmsBridgeScreenState();
}

class _CloudKmsBridgeScreenState extends State<CloudKmsBridgeScreen> {
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
      appBar: AppBar(title: const Text('Cloud KMS Bridge'), backgroundColor: Colors.green[700]),
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
            _kpi('Keys', '45', Icons.key),
            _kpi('Encryptions/hr', '12K', Icons.lock),
            _kpi('Rotations', 'Monthly', Icons.autorenew),
            _kpi('HSM Backed', 'Yes', Icons.security),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.lock, color: Colors.green),
              title: Text('Data Encryption Key'),
              subtitle: Text('AES-256-GCM'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.key, color: Colors.green),
              title: Text('Token Signing'),
              subtitle: Text('RSA-2048'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.credit_card, color: Colors.green),
              title: Text('PCI Key Block'),
              subtitle: Text('3DES-CBC'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
