import 'package:flutter/material.dart';

class CommodityPriceIntelligenceScreen extends StatefulWidget {
  const CommodityPriceIntelligenceScreen({super.key});
  @override
  State<CommodityPriceIntelligenceScreen> createState() => _CommodityPriceIntelligenceScreenState();
}

class _CommodityPriceIntelligenceScreenState extends State<CommodityPriceIntelligenceScreen> {
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
      appBar: AppBar(title: const Text('Commodity Price Intelligence'), backgroundColor: Colors.green[700]),
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
            _kpi('Tracked', '24', Icons.trending_up),
            _kpi('Alerts', '5', Icons.notifications),
            _kpi('Forecasts', 'Weekly', Icons.schedule),
            _kpi('Accuracy', '87%', Icons.gps_fixed),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.agriculture, color: Colors.green),
              title: Text('Rice Price Alert'),
              subtitle: Text('Up 5% this week'),
              trailing: Text('₦42K/bag', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.show_chart, color: Colors.green),
              title: Text('Maize Forecast'),
              subtitle: Text('Expected stable'),
              trailing: Text('₦28.5K', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
