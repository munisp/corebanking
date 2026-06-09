import 'package:flutter/material.dart';

class Ifrs9EngineScreen extends StatefulWidget {
  const Ifrs9EngineScreen({super.key});
  @override
  State<Ifrs9EngineScreen> createState() => _Ifrs9EngineScreenState();
}

class _Ifrs9EngineScreenState extends State<Ifrs9EngineScreen> {
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
      appBar: AppBar(title: const Text('Ifrs9 Engine'), backgroundColor: Colors.green[700]),
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
              _kpi('ECL Provision', '₦45.2B', Icons.shield),
              _kpi('Stage 1', '₦285B', Icons.check_circle),
              _kpi('Stage 2', '₦42B', Icons.warning),
              _kpi('Stage 3', '₦18.5B', Icons.error),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Stage 1: Performing'),
              subtitle: Text('12-month ECL'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('PD×LGD×EAD = ₦8.2B', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Calculated', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Stage 2: Underperforming'),
              subtitle: Text('Lifetime ECL'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('PD×LGD×EAD = ₦18.5B', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Calculated', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Stage 3: Non-Performing'),
              subtitle: Text('Lifetime ECL'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('LGD×EAD = ₦18.5B', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Calculated', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('SICR Assessment'),
              subtitle: Text('Quarterly'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('342 accounts migrated', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Completed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
