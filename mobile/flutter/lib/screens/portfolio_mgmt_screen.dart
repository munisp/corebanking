import 'package:flutter/material.dart';

class PortfolioMgmtScreen extends StatefulWidget {
  const PortfolioMgmtScreen({super.key});
  @override
  State<PortfolioMgmtScreen> createState() => _PortfolioMgmtScreenState();
}

class _PortfolioMgmtScreenState extends State<PortfolioMgmtScreen> {
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
      appBar: AppBar(title: const Text('Portfolio Mgmt'), backgroundColor: Colors.green[700]),
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
              _kpi('Total AUM', '₦580B', Icons.pie_chart),
              _kpi('Active Funds', '18', Icons.folder),
              _kpi('YTD Return', '+22%', Icons.trending_up),
              _kpi('Benchmark', '+18%', Icons.flag),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('54Bank Equity Fund'),
              subtitle: Text('Equity'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦85B AUM', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Outperforming', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('54Bank Bond Fund'),
              subtitle: Text('Fixed Income'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦150B AUM', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('On-Track', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('54Bank Balanced Fund'),
              subtitle: Text('Mixed'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦120B AUM', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Outperforming', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('54Bank Money Market'),
              subtitle: Text('Liquidity'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦225B AUM', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('On-Track', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
