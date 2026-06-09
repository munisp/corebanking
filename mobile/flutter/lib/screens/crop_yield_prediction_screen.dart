import 'package:flutter/material.dart';

class CropYieldPredictionScreen extends StatefulWidget {
  const CropYieldPredictionScreen({super.key});
  @override
  State<CropYieldPredictionScreen> createState() => _CropYieldPredictionScreenState();
}

class _CropYieldPredictionScreenState extends State<CropYieldPredictionScreen> {
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
      appBar: AppBar(title: const Text('Crop Yield Prediction'), backgroundColor: Colors.green[700]),
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
            _kpi('Models', '6', Icons.psychology),
            _kpi('Accuracy', '87%', Icons.gps_fixed),
            _kpi('Farms Covered', '12,500', Icons.agriculture),
            _kpi('Predictions', '45K', Icons.trending_up),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.agriculture, color: Colors.green),
              title: Text('Rice (Kebbi)'),
              subtitle: Text('Expected 3.2t/ha'),
              trailing: Text('+5% vs avg', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.agriculture, color: Colors.green),
              title: Text('Maize (Kaduna)'),
              subtitle: Text('Expected 2.8t/ha'),
              trailing: Text('-2% vs avg', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
