import 'package:flutter/material.dart';

class ProductFactoryScreen extends StatefulWidget {
  const ProductFactoryScreen({super.key});
  @override
  State<ProductFactoryScreen> createState() => _ProductFactoryScreenState();
}

class _ProductFactoryScreenState extends State<ProductFactoryScreen> {
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
      appBar: AppBar(title: const Text('Product Factory'), backgroundColor: Colors.green[700]),
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
              _kpi('Products Created', '185', Icons.factory),
              _kpi('In Draft', '12', Icons.drafts),
              _kpi('Pending Approval', '5', Icons.pending),
              _kpi('Retired', '23', Icons.archive),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Agriculture Input Loan'),
              subtitle: Text('New Product'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('CBN anchor rate', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('In Review', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Diaspora Fixed Deposit'),
              subtitle: Text('New Product'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('22% p.a.', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Approved', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Student Account (Under 18)'),
              subtitle: Text('New Product'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦0 charges', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('In Review', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('SME Overdraft Facility'),
              subtitle: Text('New Product'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('MPR + 5%', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Draft', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
