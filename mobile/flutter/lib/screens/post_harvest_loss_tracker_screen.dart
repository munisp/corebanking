import 'package:flutter/material.dart';

class PostHarvestLossTrackerScreen extends StatefulWidget {
  const PostHarvestLossTrackerScreen({super.key});
  @override
  State<PostHarvestLossTrackerScreen> createState() => _PostHarvestLossTrackerScreenState();
}

class _PostHarvestLossTrackerScreenState extends State<PostHarvestLossTrackerScreen> {
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
      appBar: AppBar(title: const Text('Post Harvest Loss Tracker'), backgroundColor: Colors.green[700]),
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
              _kpi('Tracked Harvests', '85K', Icons.agriculture),
              _kpi('Avg Loss', '12.5%', Icons.trending_down),
              _kpi('Value Lost', '₦125B/yr', Icons.money_off),
              _kpi('Interventions', '450', Icons.build),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Storage Loss Monitor'),
              subtitle: Text('IoT Sensors'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Temperature + humidity', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Transportation Loss'),
              subtitle: Text('GPS + vibration'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Truck monitoring', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Market Price Delta'),
              subtitle: Text('Analytics'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Farm vs market price', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Cold Chain Finance'),
              subtitle: Text('Working Capital'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦8.5B for cold storage', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
