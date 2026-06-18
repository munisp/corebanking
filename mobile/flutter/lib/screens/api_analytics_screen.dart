import 'package:flutter/material.dart';

class APIAnalyticsScreen extends StatefulWidget {
  const APIAnalyticsScreen({super.key});
  @override
  State<APIAnalyticsScreen> createState() => _APIAnalyticsScreenState();
}

class _APIAnalyticsScreenState extends State<APIAnalyticsScreen> {
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
      appBar: AppBar(title: const Text('Api Analytics'), backgroundColor: Colors.green[700]),
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
              _kpi('API Calls/Day', '12.5M', Icons.api),
              _kpi('Avg Latency', '28ms', Icons.speed),
              _kpi('Error Rate', '0.08%', Icons.error_outline),
              _kpi('Top Endpoint', '/v1/transfers', Icons.star),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('POST /v1/transfers'),
              subtitle: Text('Write'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('3.2M/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('GET /v1/accounts/balance'),
              subtitle: Text('Read'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('5.8M/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('POST /v1/payments/nibss'),
              subtitle: Text('Write'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('1.2M/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('GET /v1/statements'),
              subtitle: Text('Read'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('850K/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
