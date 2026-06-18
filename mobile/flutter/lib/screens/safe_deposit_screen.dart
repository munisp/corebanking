import 'package:flutter/material.dart';

class SafeDepositScreen extends StatefulWidget {
  const SafeDepositScreen({super.key});
  @override
  State<SafeDepositScreen> createState() => _SafeDepositScreenState();
}

class _SafeDepositScreenState extends State<SafeDepositScreen> {
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
      appBar: AppBar(title: const Text('Safe Deposit'), backgroundColor: Colors.green[700]),
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
              _kpi('Boxes Rented', '8,500', Icons.lock),
              _kpi('Revenue', '₦2.8B', Icons.money),
              _kpi('Occupancy', '85%', Icons.data_usage),
              _kpi('Branches', '120', Icons.store),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Small Box (10×5×22)'),
              subtitle: Text('Annual'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦150K/year', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Available', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Medium Box (10×10×22)'),
              subtitle: Text('Annual'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦300K/year', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('85% Full', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Large Box (10×10×48)'),
              subtitle: Text('Annual'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦500K/year', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('92% Full', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Vault Room'),
              subtitle: Text('Premium'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦2M/year', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Waitlist', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
