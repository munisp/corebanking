import 'package:flutter/material.dart';

class BrowserFingerprintScreen extends StatefulWidget {
  const BrowserFingerprintScreen({super.key});
  @override
  State<BrowserFingerprintScreen> createState() => _BrowserFingerprintScreenState();
}

class _BrowserFingerprintScreenState extends State<BrowserFingerprintScreen> {
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
      appBar: AppBar(title: const Text('Browser Fingerprint'), backgroundColor: Colors.green[700]),
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
            _kpi('Profiles', '45K', Icons.fingerprint),
            _kpi('Flagged', '234', Icons.warning),
            _kpi('Blocked', '12', Icons.block),
            _kpi('Accuracy', '98.5%', Icons.gps_fixed),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.brush, color: Colors.green),
              title: Text('Canvas FP'),
              subtitle: Text('Hash-based matching'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.memory, color: Colors.green),
              title: Text('WebGL FP'),
              subtitle: Text('GPU-based'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.audiotrack, color: Colors.green),
              title: Text('Audio FP'),
              subtitle: Text('Audio context hash'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
