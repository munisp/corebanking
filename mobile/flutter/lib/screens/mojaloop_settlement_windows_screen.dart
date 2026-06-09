import 'package:flutter/material.dart';

class MojaloopSettlementWindowsScreen extends StatefulWidget {
  const MojaloopSettlementWindowsScreen({super.key});
  @override
  State<MojaloopSettlementWindowsScreen> createState() => _MojaloopSettlementWindowsScreenState();
}

class _MojaloopSettlementWindowsScreenState extends State<MojaloopSettlementWindowsScreen> {
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
      appBar: AppBar(title: const Text('Mojaloop Settlement Windows'), backgroundColor: Colors.green[700]),
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
              _kpi('Windows Today', '48', Icons.window),
              _kpi('Open', '1', Icons.lock_open),
              _kpi('Settled', '47', Icons.check),
              _kpi('Net Position', '₦0.00', Icons.balance),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Window #48 (Current)'),
              subtitle: Text('Open'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦125M volume', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Open', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Window #47 (15:00)'),
              subtitle: Text('Settled'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦250M settled', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Settled', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Window #46 (14:45)'),
              subtitle: Text('Settled'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦180M settled', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Settled', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Window #45 (14:30)'),
              subtitle: Text('Settled'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦220M settled', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Settled', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
