import 'package:flutter/material.dart';

class EODProcessorScreen extends StatefulWidget {
  const EODProcessorScreen({super.key});
  @override
  State<EODProcessorScreen> createState() => _EODProcessorScreenState();
}

class _EODProcessorScreenState extends State<EODProcessorScreen> {
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
      appBar: AppBar(title: const Text('EOD Processor'), backgroundColor: Colors.green[700]),
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
              _kpi('EOD Status', 'Completed', Icons.check_circle),
              _kpi('Run Time', '42 min', Icons.timer),
              _kpi('GL Entries', '2.5M', Icons.receipt),
              _kpi('Exceptions', '12', Icons.warning),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Interest Accrual Batch'),
              subtitle: Text('Daily'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦2.8B posted', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Completed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('GL Day-End Balancing'),
              subtitle: Text('Daily'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦0.00 variance', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Balanced', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Dormancy Check'),
              subtitle: Text('Daily'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('45 accounts flagged', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Completed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('CBN Regulatory Returns'),
              subtitle: Text('Daily'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('e-FASS submitted', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Submitted', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
