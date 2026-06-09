import 'package:flutter/material.dart';

class PGTuningParamsScreen extends StatefulWidget {
  const PGTuningParamsScreen({super.key});
  @override
  State<PGTuningParamsScreen> createState() => _PGTuningParamsScreenState();
}

class _PGTuningParamsScreenState extends State<PGTuningParamsScreen> {
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
      appBar: AppBar(title: const Text('PG Tuning Params'), backgroundColor: Colors.green[700]),
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
              _kpi('Parameters Tuned', '45', Icons.tune),
              _kpi('Shared Buffers', '32GB', Icons.memory),
              _kpi('Work Mem', '256MB', Icons.developer_board),
              _kpi('WAL Level', 'Replica', Icons.sync),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('shared_buffers = 32GB'),
              subtitle: Text('Memory'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('25% of RAM', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Tuned', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('effective_cache_size = 96GB'),
              subtitle: Text('Planner'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('75% of RAM', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Tuned', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('max_connections = 500'),
              subtitle: Text('Connections'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Via pgbouncer', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Tuned', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('checkpoint_timeout = 15min'),
              subtitle: Text('WAL'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Balanced I/O', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Tuned', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
