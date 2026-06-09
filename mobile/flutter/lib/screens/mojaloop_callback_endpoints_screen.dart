import 'package:flutter/material.dart';

class MojaloopCallbackEndpointsScreen extends StatefulWidget {
  const MojaloopCallbackEndpointsScreen({super.key});
  @override
  State<MojaloopCallbackEndpointsScreen> createState() => _MojaloopCallbackEndpointsScreenState();
}

class _MojaloopCallbackEndpointsScreenState extends State<MojaloopCallbackEndpointsScreen> {
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
      appBar: AppBar(title: const Text('Mojaloop Callback Endpoints'), backgroundColor: Colors.green[700]),
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
              _kpi('Registered Endpoints', '72', Icons.link),
              _kpi('TLS Verified', '100%', Icons.lock),
              _kpi('Health Check', '10s', Icons.favorite),
              _kpi('Timeout', '30s', Icons.timer),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('fspiop-callback-url-transfer'),
              subtitle: Text('Per-DFSP'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('36 endpoints', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Verified', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('fspiop-callback-url-quotes'),
              subtitle: Text('Per-DFSP'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('36 endpoints', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Verified', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('fspiop-callback-url-parties'),
              subtitle: Text('Per-DFSP'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('36 endpoints', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Verified', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('fspiop-callback-url-auth'),
              subtitle: Text('Per-DFSP'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('12 endpoints', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Verified', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
