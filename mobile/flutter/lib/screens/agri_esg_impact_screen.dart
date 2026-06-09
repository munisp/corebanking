import 'package:flutter/material.dart';

class AgriEsgImpactScreen extends StatefulWidget {
  const AgriEsgImpactScreen({super.key});
  @override
  State<AgriEsgImpactScreen> createState() => _AgriEsgImpactScreenState();
}

class _AgriEsgImpactScreenState extends State<AgriEsgImpactScreen> {
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
      appBar: AppBar(title: const Text('Agriculture ESG Impact'), backgroundColor: Colors.green[700]),
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
            _kpi('Carbon Offset', '2,450t', Icons.eco),
            _kpi('Water Saved', '15M L', Icons.water_drop),
            _kpi('Farmers', '12,500', Icons.people),
            _kpi('ESG Score', '78/100', Icons.assessment),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.agriculture, color: Colors.green),
              title: Text('Sustainable Farming'),
              subtitle: Text('3,200 trained'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.solar_power, color: Colors.green),
              title: Text('Solar Irrigation'),
              subtitle: Text('450 units'),
              trailing: Text('₦180M', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
