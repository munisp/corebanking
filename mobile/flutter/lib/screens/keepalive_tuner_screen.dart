import 'package:flutter/material.dart';

class KeepaliveTunerScreen extends StatefulWidget {
  const KeepaliveTunerScreen({super.key});
  @override
  State<KeepaliveTunerScreen> createState() => _KeepaliveTunerScreenState();
}

class _KeepaliveTunerScreenState extends State<KeepaliveTunerScreen> {
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
      appBar: AppBar(title: const Text('Keepalive Tuner'), backgroundColor: Colors.green[700]),
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
              _kpi('TCP Conns', '125K', Icons.cable),
              _kpi('Keepalive', '30s', Icons.timer),
              _kpi('Idle Timeout', '300s', Icons.schedule),
              _kpi('Stale/hr', '850', Icons.cleaning_services),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('gRPC Channels'),
              subtitle: Text('HTTP/2'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('30s keepalive', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Tuned', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('DB Connection Pool'),
              subtitle: Text('TCP'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('60s keepalive', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Tuned', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Redis Persistent'),
              subtitle: Text('TCP'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('15s keepalive', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Tuned', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('External API'),
              subtitle: Text('HTTP/1.1'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('90s keepalive', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Tuned', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
