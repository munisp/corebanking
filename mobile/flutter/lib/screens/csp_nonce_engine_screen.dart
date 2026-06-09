import 'package:flutter/material.dart';

class CspNonceEngineScreen extends StatefulWidget {
  const CspNonceEngineScreen({super.key});
  @override
  State<CspNonceEngineScreen> createState() => _CspNonceEngineScreenState();
}

class _CspNonceEngineScreenState extends State<CspNonceEngineScreen> {
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
      appBar: AppBar(title: const Text('CSP Nonce Engine'), backgroundColor: Colors.green[700]),
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
            _kpi('Pages', '567', Icons.web),
            _kpi('Nonces/sec', '450', Icons.key),
            _kpi('Violations', '0', Icons.shield),
            _kpi('Report-Only', '3', Icons.analytics),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.code, color: Colors.green),
              title: Text('Script Nonce'),
              subtitle: Text('Generated per request'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.format_paint, color: Colors.green),
              title: Text('Style Nonce'),
              subtitle: Text('Inline styles'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
