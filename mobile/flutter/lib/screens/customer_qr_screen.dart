import 'package:flutter/material.dart';

class CustomerQrScreen extends StatefulWidget {
  const CustomerQrScreen({super.key});
  @override
  State<CustomerQrScreen> createState() => _CustomerQrScreenState();
}

class _CustomerQrScreenState extends State<CustomerQrScreen> {
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
      appBar: AppBar(title: const Text('Customer QR'), backgroundColor: Colors.green[700]),
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
            _kpi('QR Generated', '2.4M', Icons.qr_code),
            _kpi('Scans Today', '45K', Icons.qr_code_scanner),
            _kpi('Payments', '₦890M', Icons.payments),
            _kpi('Merchants', '12K', Icons.store),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.qr_code, color: Colors.green),
              title: Text('Static QR'),
              subtitle: Text('Merchant display'),
              trailing: Text('8K active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.qr_code_2, color: Colors.green),
              title: Text('Dynamic QR'),
              subtitle: Text('Amount-specific'),
              trailing: Text('45K/day', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
