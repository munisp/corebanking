import 'package:flutter/material.dart';

class GraduatedRolloutScreen extends StatefulWidget {
  const GraduatedRolloutScreen({super.key});
  @override
  State<GraduatedRolloutScreen> createState() => _GraduatedRolloutScreenState();
}

class _GraduatedRolloutScreenState extends State<GraduatedRolloutScreen> {
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
      appBar: AppBar(title: const Text('Graduated Rollout'), backgroundColor: Colors.green[700]),
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
              _kpi('Active Rollouts', '8', Icons.rocket_launch),
              _kpi('Canary', '5%', Icons.science),
              _kpi('Error Budget', '0.05%', Icons.data_usage),
              _kpi('Rollback Ready', '100%', Icons.undo),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Transfer Engine v3.2'),
              subtitle: Text('Canary→Linear'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('5%→25%→50%→100%', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('At 25%', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Islamic Banking Module'),
              subtitle: Text('Feature Flag'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Islamic accounts', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('At 100%', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('WhatsApp Banking v2'),
              subtitle: Text('Ring-based'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Internal→Beta→GA', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Beta', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('New KYC OCR Engine'),
              subtitle: Text('Shadow Mode'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Running parallel', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Monitoring', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
