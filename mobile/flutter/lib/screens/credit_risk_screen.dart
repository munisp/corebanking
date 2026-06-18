import 'package:flutter/material.dart';

class CreditRiskScreen extends StatefulWidget {
  const CreditRiskScreen({super.key});
  @override
  State<CreditRiskScreen> createState() => _CreditRiskScreenState();
}

class _CreditRiskScreenState extends State<CreditRiskScreen> {
  final Map<String, dynamic> _portfolio = {
    'totalExposure': 180000000000,
    'npl': 8100000000,
    'nplRatio': 4.5,
    'coverage': 87.5,
    'stage1': 156000000000,
    'stage2': 15900000000,
    'stage3': 8100000000,
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Credit Risk Dashboard'), backgroundColor: Colors.red[700]),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(children: [
        Row(children: [
          Expanded(child: _riskCard('Total Exposure', '₦${((_portfolio["totalExposure"] as int) / 1000000000).toStringAsFixed(0)}B', Colors.blue, Icons.account_balance)),
          Expanded(child: _riskCard('NPL', '₦${((_portfolio["npl"] as int) / 1000000000).toStringAsFixed(1)}B', Colors.red, Icons.warning)),
        ]),
        Row(children: [
          Expanded(child: _riskCard('NPL Ratio', '${_portfolio["nplRatio"]}%', (_portfolio["nplRatio"] as double) > 5 ? Colors.red : Colors.green, Icons.pie_chart)),
          Expanded(child: _riskCard('Coverage', '${_portfolio["coverage"]}%', Colors.teal, Icons.shield)),
        ]),
        const SizedBox(height: 16),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('IFRS 9 Staging', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          _stageBar('Stage 1 (Performing)', (_portfolio['stage1'] as int) / (_portfolio['totalExposure'] as int), Colors.green),
          _stageBar('Stage 2 (Watch)', (_portfolio['stage2'] as int) / (_portfolio['totalExposure'] as int), Colors.orange),
          _stageBar('Stage 3 (Default)', (_portfolio['stage3'] as int) / (_portfolio['totalExposure'] as int), Colors.red),
        ]))),
        const SizedBox(height: 16),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('CBN Prudential Guidelines', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          _guidelineRow('NPL Ratio', '${_portfolio["nplRatio"]}%', '< 5%', (_portfolio["nplRatio"] as double) < 5),
          _guidelineRow('Coverage Ratio', '${_portfolio["coverage"]}%', '> 100%', (_portfolio["coverage"] as double) > 100),
          _guidelineRow('Single Obligor Limit', '18%', '< 20%', true),
          _guidelineRow('Related Party Exposure', '8%', '< 10%', true),
          _guidelineRow('Capital Adequacy', '16.2%', '> 15%', true),
        ]))),
      ])),
    );
  }

  Widget _riskCard(String title, String value, Color color, IconData icon) {
    return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
      Icon(icon, color: color, size: 28), const SizedBox(height: 4),
      Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
      Text(title, style: const TextStyle(fontSize: 11, color: Colors.grey)),
    ])));
  }

  Widget _stageBar(String label, double ratio, Color color) {
    return Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label), Text('${(ratio * 100).toStringAsFixed(1)}%')]),
      const SizedBox(height: 4),
      LinearProgressIndicator(value: ratio, backgroundColor: Colors.grey[200], color: color, minHeight: 12),
    ]));
  }

  Widget _guidelineRow(String metric, String actual, String limit, bool compliant) {
    return ListTile(dense: true,
      leading: Icon(compliant ? Icons.check_circle : Icons.cancel, color: compliant ? Colors.green : Colors.red, size: 20),
      title: Text(metric), trailing: Text('$actual (Limit: $limit)', style: TextStyle(color: compliant ? Colors.green : Colors.red)));
  }
}
