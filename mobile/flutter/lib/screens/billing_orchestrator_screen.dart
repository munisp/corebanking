import 'package:flutter/material.dart';

class BillingOrchestratorScreen extends StatefulWidget {
  const BillingOrchestratorScreen({super.key});
  @override
  State<BillingOrchestratorScreen> createState() => _BillingOrchestratorScreenState();
}

class _BillingOrchestratorScreenState extends State<BillingOrchestratorScreen> {
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
      appBar: AppBar(title: const Text('Billing Orchestrator'), backgroundColor: Colors.green[700]),
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
            _kpi('Active Plans', '45', Icons.receipt),
            _kpi('Revenue MTD', '₦890M', Icons.payments),
            _kpi('Unbilled', '₦12M', Icons.pending),
            _kpi('Overdue', '₦2.3M', Icons.warning),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.account_balance, color: Colors.green),
              title: Text('Account maintenance'),
              subtitle: Text('₦100-₦300/month'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.swap_horiz, color: Colors.green),
              title: Text('Transaction fees'),
              subtitle: Text('Volume-based'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.star, color: Colors.green),
              title: Text('Premium features'),
              subtitle: Text('₦500/month add-on'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
