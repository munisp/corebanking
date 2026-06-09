import 'package:flutter/material.dart';

class BrandedCommsScreen extends StatefulWidget {
  const BrandedCommsScreen({super.key});
  @override
  State<BrandedCommsScreen> createState() => _BrandedCommsScreenState();
}

class _BrandedCommsScreenState extends State<BrandedCommsScreen> {
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
      appBar: AppBar(title: const Text('Branded Communications'), backgroundColor: Colors.green[700]),
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
            _kpi('Templates', '45', Icons.email),
            _kpi('Sent Today', '125K', Icons.send),
            _kpi('Open Rate', '34%', Icons.visibility),
            _kpi('Click Rate', '12%', Icons.touch_app),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.waving_hand, color: Colors.green),
              title: Text('Welcome Email'),
              subtitle: Text('New account onboarding'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.notifications, color: Colors.green),
              title: Text('Transaction Alert'),
              subtitle: Text('Debit/Credit SMS'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.description, color: Colors.green),
              title: Text('Statement'),
              subtitle: Text('Monthly PDF'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
