import 'package:flutter/material.dart';

class ClickjackDefenderScreen extends StatefulWidget {
  const ClickjackDefenderScreen({super.key});
  @override
  State<ClickjackDefenderScreen> createState() => _ClickjackDefenderScreenState();
}

class _ClickjackDefenderScreenState extends State<ClickjackDefenderScreen> {
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
      appBar: AppBar(title: const Text('Clickjack Defender'), backgroundColor: Colors.green[700]),
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
            _kpi('Protected Pages', '567', Icons.shield),
            _kpi('Blocked', '12/day', Icons.block),
            _kpi('X-Frame', 'DENY', Icons.code),
            _kpi('CSP Frames', 'self', Icons.security),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.shield, color: Colors.green),
              title: Text('X-Frame-Options'),
              subtitle: Text('DENY on all responses'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.code, color: Colors.green),
              title: Text('CSP frame-ancestors'),
              subtitle: Text('self only'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
