import 'package:flutter/material.dart';

class AMLComplianceDashboardScreen extends StatefulWidget {
  const AMLComplianceDashboardScreen({super.key});
  @override
  State<AMLComplianceDashboardScreen> createState() => _AMLComplianceDashboardScreenState();
}

class _AMLComplianceDashboardScreenState extends State<AMLComplianceDashboardScreen> {
  final Map<String, dynamic> _metrics = {
    'str_filed_ytd': 47, 'ctr_filed_ytd': 1204, 'sar_pending': 5,
    'avg_resolution_days': 8.3, 'false_positive_rate': 12.5, 'screening_coverage': 99.8,
  };

  final List<Map<String, dynamic>> _recentFilings = [
    {'type': 'STR', 'ref': 'STR-2024-047', 'customer': 'ABC Holdings', 'amount': 49500000, 'filed': '2024-01-28', 'nfiu_status': 'acknowledged'},
    {'type': 'CTR', 'ref': 'CTR-2024-1204', 'customer': 'Cash Deposit', 'amount': 15000000, 'filed': '2024-01-28', 'nfiu_status': 'submitted'},
    {'type': 'STR', 'ref': 'STR-2024-046', 'customer': 'XYZ Imports', 'amount': 89000000, 'filed': '2024-01-25', 'nfiu_status': 'under_review'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AML Compliance'), actions: [
        IconButton(icon: const Icon(Icons.download), onPressed: () {}),
      ]),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          GridView.count(crossAxisCount: 3, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 1.2, crossAxisSpacing: 8, mainAxisSpacing: 8, children: [
              _metricCard('STR Filed', '${_metrics["str_filed_ytd"]}', Colors.orange),
              _metricCard('CTR Filed', '${_metrics["ctr_filed_ytd"]}', Colors.blue),
              _metricCard('Pending', '${_metrics["sar_pending"]}', Colors.red),
              _metricCard('Avg Days', '${_metrics["avg_resolution_days"]}', Colors.purple),
              _metricCard('False +ve', '${_metrics["false_positive_rate"]}%', Colors.amber),
              _metricCard('Coverage', '${_metrics["screening_coverage"]}%', Colors.green),
            ],
          ),
          const SizedBox(height: 24),
          const Text('Recent NFIU Filings', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ...List.generate(_recentFilings.length, (i) {
            final f = _recentFilings[i];
            return Card(child: ListTile(
              leading: CircleAvatar(backgroundColor: f['type'] == 'STR' ? Colors.orange : Colors.blue,
                child: Text(f['type'], style: const TextStyle(color: Colors.white, fontSize: 11))),
              title: Text('${f["ref"]} - ${f["customer"]}'),
              subtitle: Text('\u20A6${(f["amount"] / 100).toStringAsFixed(0)} | ${f["filed"]}'),
              trailing: Chip(label: Text(f['nfiu_status'].replaceAll('_', ' '), style: const TextStyle(fontSize: 10))),
            ));
          }),
          const SizedBox(height: 16),
          Card(color: Colors.amber.shade50, child: const Padding(
            padding: EdgeInsets.all(12),
            child: Row(children: [
              Icon(Icons.info, color: Colors.amber),
              SizedBox(width: 8),
              Expanded(child: Text('NFIU 72-hour STR filing deadline. 5 cases approaching deadline.', style: TextStyle(fontSize: 13))),
            ]),
          )),
        ]),
      ),
    );
  }

  Widget _metricCard(String label, String value, Color color) => Card(child: Padding(
    padding: const EdgeInsets.all(8),
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
      const SizedBox(height: 4),
      Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey), textAlign: TextAlign.center),
    ]),
  ));
}
