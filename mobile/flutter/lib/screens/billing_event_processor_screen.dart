import 'package:flutter/material.dart';

class BillingEventProcessorScreen extends StatefulWidget {
  const BillingEventProcessorScreen({super.key});
  @override
  State<BillingEventProcessorScreen> createState() => _BillingEventProcessorScreenState();
}

class _BillingEventProcessorScreenState extends State<BillingEventProcessorScreen> {
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
      appBar: AppBar(title: const Text('Billing Event Processor'), backgroundColor: Colors.green[700]),
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
            _kpi('Events/sec', '4,500', Icons.bolt),
            _kpi('Processed', '12.4M', Icons.check),
            _kpi('Failed', '23', Icons.error),
            _kpi('Lag', '120ms', Icons.timer),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.swap_horiz, color: Colors.green),
              title: Text('Transfer fees'),
              subtitle: Text('₦25-₦50 per txn'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.sms, color: Colors.green),
              title: Text('SMS alerts'),
              subtitle: Text('₦4 per SMS'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.credit_card, color: Colors.green),
              title: Text('Card maintenance'),
              subtitle: Text('₦1K/quarter'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
