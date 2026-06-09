import 'package:flutter/material.dart';

class Customer360DashboardScreen extends StatefulWidget {
  const Customer360DashboardScreen({super.key});
  @override
  State<Customer360DashboardScreen> createState() => _Customer360DashboardScreenState();
}

class _Customer360DashboardScreenState extends State<Customer360DashboardScreen> {
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
      appBar: AppBar(title: const Text('Customer 360 Dashboard'), backgroundColor: Colors.green[700]),
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
            _kpi('Total Customers', '3.2M', Icons.people),
            _kpi('Active', '2.8M', Icons.check_circle),
            _kpi('NPS', '72', Icons.sentiment_satisfied),
            _kpi('Churn Rate', '2.1%', Icons.trending_down),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.person, color: Colors.green),
              title: Text('Retail Banking'),
              subtitle: Text('2.4M customers'),
              trailing: Text('₦890B AUM', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.business, color: Colors.green),
              title: Text('Corporate'),
              subtitle: Text('45K customers'),
              trailing: Text('₦2.4T AUM', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.store, color: Colors.green),
              title: Text('SME'),
              subtitle: Text('180K customers'),
              trailing: Text('₦120B AUM', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
