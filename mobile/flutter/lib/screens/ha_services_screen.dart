import 'package:flutter/material.dart';

class HAServicesScreen extends StatefulWidget {
  const HAServicesScreen({super.key});
  @override
  State<HAServicesScreen> createState() => _HAServicesScreenState();
}

class _HAServicesScreenState extends State<HAServicesScreen> {
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
      appBar: AppBar(title: const Text('HA Services'), backgroundColor: Colors.green[700]),
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
              _kpi('Monitored', '512', Icons.monitor_heart),
              _kpi('Healthy', '512', Icons.check_circle),
              _kpi('Degraded', '0', Icons.warning),
              _kpi('Circuits Open', '0', Icons.shield),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Critical (Transfers)'),
              subtitle: Text('3x redundancy'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('99.999% SLA', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('99.999%', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Core (Accounts)'),
              subtitle: Text('2x redundancy'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('99.99% SLA', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('99.99%', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Supporting (Reports)'),
              subtitle: Text('1x+standby'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('99.9% SLA', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('99.95%', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Background (ETL)'),
              subtitle: Text('Retry-safe'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('99.5% SLA', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('99.8%', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
