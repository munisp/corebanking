import 'package:flutter/material.dart';

class RequestCoalescerScreen extends StatefulWidget {
  const RequestCoalescerScreen({super.key});
  @override
  State<RequestCoalescerScreen> createState() => _RequestCoalescerScreenState();
}

class _RequestCoalescerScreenState extends State<RequestCoalescerScreen> {
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
      appBar: AppBar(title: const Text('Request Coalescer'), backgroundColor: Colors.green[700]),
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
              _kpi('Coalesced/s', '12K', Icons.compress),
              _kpi('Dedup Rate', '25%', Icons.filter_alt),
              _kpi('Latency Saved', '45ms avg', Icons.timer),
              _kpi('Backend Load', '−25%', Icons.trending_down),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Balance Inquiry Coalesce'),
              subtitle: Text('Same account, 100ms window'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('30% dedup', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('FX Rate Coalesce'),
              subtitle: Text('Same pair, 1s window'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('85% dedup', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Profile Lookup Coalesce'),
              subtitle: Text('Same customer, 500ms'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('20% dedup', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Statement Request Coalesce'),
              subtitle: Text('Same params, 5s window'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('15% dedup', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
