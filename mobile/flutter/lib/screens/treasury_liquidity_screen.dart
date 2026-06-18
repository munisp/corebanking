import 'package:flutter/material.dart';

class TreasuryLiquidityScreen extends StatefulWidget {
  const TreasuryLiquidityScreen({super.key});
  @override
  State<TreasuryLiquidityScreen> createState() => _TreasuryLiquidityScreenState();
}

class _TreasuryLiquidityScreenState extends State<TreasuryLiquidityScreen> {
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
      appBar: AppBar(title: const Text('Treasury Liquidity'), backgroundColor: Colors.green[700]),
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
              _kpi('Liquidity Ratio', '42%', Icons.water_drop),
              _kpi('CRR Balance', '₦120B', Icons.lock),
              _kpi('Available Cash', '₦85B', Icons.money),
              _kpi('LCR', '185%', Icons.shield),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Cash Reserve Requirement'),
              subtitle: Text('CBN Mandated'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦120B (32.5%)', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Compliant', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Liquidity Ratio'),
              subtitle: Text('CBN Minimum 30%'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('42%', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Compliant', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Net Stable Funding Ratio'),
              subtitle: Text('Basel III'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('125%', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Compliant', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Intraday Liquidity Buffer'),
              subtitle: Text('Operational'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦45B', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Adequate', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
