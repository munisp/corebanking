import 'package:flutter/material.dart';

class TBPGReconciliationRunsScreen extends StatefulWidget {
  const TBPGReconciliationRunsScreen({super.key});
  @override
  State<TBPGReconciliationRunsScreen> createState() => _TBPGReconciliationRunsScreenState();
}

class _TBPGReconciliationRunsScreenState extends State<TBPGReconciliationRunsScreen> {
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
      appBar: AppBar(title: const Text('TB PG Reconciliation Runs'), backgroundColor: Colors.green[700]),
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
              _kpi('Runs Today', '288', Icons.replay),
              _kpi('Pass Rate', '99.97%', Icons.check),
              _kpi('Breaks', '8', Icons.warning),
              _kpi('Auto-resolved', '6', Icons.auto_fix_high),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Run #288 (16:00)'),
              subtitle: Text('5-min balance check'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('12.5M accounts matched', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Run #287 (15:55)'),
              subtitle: Text('5-min balance check'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('2 breaks → auto-resolved', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Run #280 (15:20)'),
              subtitle: Text('5-min balance check'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('0 breaks', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('EOD Run (23:59)'),
              subtitle: Text('Full reconciliation'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Trial balance + settlement', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Scheduled', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
