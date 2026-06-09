import 'package:flutter/material.dart';

class FXPositionsScreen extends StatefulWidget {
  const FXPositionsScreen({super.key});
  @override
  State<FXPositionsScreen> createState() => _FXPositionsScreenState();
}

class _FXPositionsScreenState extends State<FXPositionsScreen> {
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
      appBar: AppBar(title: const Text('FX Positions'), backgroundColor: Colors.green[700]),
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
              _kpi('Net Position', '$12.5M Long', Icons.trending_up),
              _kpi('Limit Used', '62%', Icons.data_usage),
              _kpi('Unrealised P&L', '+₦45M', Icons.money),
              _kpi('Open Deals', '28', Icons.receipt_long),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('USD Long Position'),
              subtitle: Text('Spot + Forward'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('$8.2M', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Within Limit', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('EUR Short Position'),
              subtitle: Text('Forward'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('-€2.1M', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Within Limit', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('GBP Long Position'),
              subtitle: Text('Spot'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('£1.5M', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Within Limit', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('CNY Long Position'),
              subtitle: Text('NDF'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('¥15M', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Approaching Limit', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
