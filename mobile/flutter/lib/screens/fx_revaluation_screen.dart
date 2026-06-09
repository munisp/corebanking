import 'package:flutter/material.dart';

class FXRevaluationScreen extends StatefulWidget {
  const FXRevaluationScreen({super.key});
  @override
  State<FXRevaluationScreen> createState() => _FXRevaluationScreenState();
}

class _FXRevaluationScreenState extends State<FXRevaluationScreen> {
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
      appBar: AppBar(title: const Text('FX Revaluation'), backgroundColor: Colors.green[700]),
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
              _kpi('Revaluation P&L', '₦2.8B', Icons.calculate),
              _kpi('FX Assets', '₦125B', Icons.trending_up),
              _kpi('FX Liabilities', '₦118B', Icons.trending_down),
              _kpi('Net Exposure', '₦7B', Icons.balance),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('USD Asset Revaluation'),
              subtitle: Text('Month-End'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('+₦1.2B', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Posted to GL', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('EUR Liability Revaluation'),
              subtitle: Text('Month-End'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('-₦450M', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Posted to GL', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('GBP Position Revaluation'),
              subtitle: Text('Month-End'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('+₦280M', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Posted to GL', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Nostro Account Reconciliation'),
              subtitle: Text('Daily'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦85B balanced', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Reconciled', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
