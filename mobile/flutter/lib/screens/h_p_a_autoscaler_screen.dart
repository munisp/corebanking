import 'package:flutter/material.dart';

class HPAAutoscalerScreen extends StatefulWidget {
  const HPAAutoscalerScreen({super.key});
  @override
  State<HPAAutoscalerScreen> createState() => _HPAAutoscalerScreenState();
}

class _HPAAutoscalerScreenState extends State<HPAAutoscalerScreen> {
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
      appBar: AppBar(title: const Text('H P A Autoscaler'), backgroundColor: Colors.green[700]),
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
              _kpi('Scaled Services', '85', Icons.auto_graph),
              _kpi('Replicas', '1,024', Icons.copy_all),
              _kpi('CPU Target', '70%', Icons.memory),
              _kpi('Scale Events/day', '125', Icons.trending_up),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('transfer-service (Go)'),
              subtitle: Text('CPU+Custom'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('12-48 pods', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('32 pods', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('balance-inquiry (Go)'),
              subtitle: Text('CPU'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('8-24 pods', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('16 pods', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('kyc-engine (Python)'),
              subtitle: Text('Queue Depth'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('4-16 pods', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('8 pods', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('notification-svc'),
              subtitle: Text('Message Rate'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('4-12 pods', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('6 pods', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
