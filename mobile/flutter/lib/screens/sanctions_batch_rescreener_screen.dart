import 'package:flutter/material.dart';

class SanctionsBatchRescreenerScreen extends StatefulWidget {
  const SanctionsBatchRescreenerScreen({super.key});
  @override
  State<SanctionsBatchRescreenerScreen> createState() => _SanctionsBatchRescreenerScreenState();
}

class _SanctionsBatchRescreenerScreenState extends State<SanctionsBatchRescreenerScreen> {
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
      appBar: AppBar(title: const Text('Sanctions Batch Rescreener'), backgroundColor: Colors.green[700]),
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
              _kpi('Rescreened', '2.5M', Icons.refresh),
              _kpi('New Matches', '12', Icons.warning),
              _kpi('Batch Time', '45min', Icons.timer),
              _kpi('Last Run', 'Today 02:00', Icons.schedule),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Full Customer Base Rescreen'),
              subtitle: Text('Nightly Batch'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('2.5M records', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Completed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('OFAC List Update Delta'),
              subtitle: Text('Daily'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('+15 entries', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Processed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('PEP Database Refresh'),
              subtitle: Text('Weekly'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('85K entries', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Completed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Adverse Media Scan'),
              subtitle: Text('Daily'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('12K articles', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Completed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
