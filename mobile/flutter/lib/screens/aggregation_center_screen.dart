import 'package:flutter/material.dart';

class AggregationCenterScreen extends StatefulWidget {
  const AggregationCenterScreen({super.key});
  @override
  State<AggregationCenterScreen> createState() => _AggregationCenterScreenState();
}

class _AggregationCenterScreenState extends State<AggregationCenterScreen> {
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
      appBar: AppBar(title: const Text('Aggregation Center'), backgroundColor: Colors.green[700]),
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
            _kpi('Volume', '₦2.4B', Icons.account_balance),
            _kpi('Txns', '145K', Icons.receipt),
            _kpi('Settlement', '2.3hrs', Icons.timer),
            _kpi('Success', '99.7%', Icons.check_circle),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.flash_on, color: Colors.green),
              title: Text('NIBSS Instant'),
              subtitle: Text('45% volume'),
              trailing: Text('₦1.08B', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.swap_horiz, color: Colors.green),
              title: Text('NIP Transfer'),
              subtitle: Text('30%'),
              trailing: Text('₦720M', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
