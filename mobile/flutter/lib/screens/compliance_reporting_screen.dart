import 'package:flutter/material.dart';

/// Compliance Reporting — NFIU/CBN regulatory reporting dashboard
class ComplianceReportingScreen extends StatefulWidget {
  const ComplianceReportingScreen({super.key});
  @override
  State<ComplianceReportingScreen> createState() => _ComplianceReportingScreenState();
}

class _ComplianceReportingScreenState extends State<ComplianceReportingScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final _ctrReports = [
    {'id': 'CTR-20260609-001', 'customer': 'Ogunlesi Trading Ltd', 'amount': 15000000, 'type': 'Cash Deposit', 'status': 'filed', 'date': '2026-06-09'},
    {'id': 'CTR-20260608-001', 'customer': 'Abiodun Farms', 'amount': 8500000, 'type': 'Cash Withdrawal', 'status': 'filed', 'date': '2026-06-08'},
    {'id': 'CTR-20260607-001', 'customer': 'Lagos Imports Inc', 'amount': 25000000, 'type': 'Wire Transfer', 'status': 'pending', 'date': '2026-06-07'},
  ];

  final _strReports = [
    {'id': 'STR-20260609-001', 'customer': 'Unknown Entity', 'reason': 'Structuring (multiple deposits below threshold)', 'risk': 'high', 'status': 'investigating'},
    {'id': 'STR-20260605-001', 'customer': 'Shell Corp Ltd', 'reason': 'Unusual transaction pattern', 'risk': 'medium', 'status': 'filed'},
  ];

  @override
  void initState() { super.initState(); _tabController = TabController(length: 3, vsync: this); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Compliance'), bottom: TabBar(controller: _tabController, tabs: const [
        Tab(text: 'CTR'), Tab(text: 'STR'), Tab(text: 'Sanctions'),
      ])),
      body: TabBarView(controller: _tabController, children: [_buildCTR(), _buildSTR(), _buildSanctions()]),
    );
  }

  Widget _buildCTR() => ListView(padding: const EdgeInsets.all(16), children: [
    Card(color: Colors.blue.shade50, child: const Padding(padding: EdgeInsets.all(12), child: Row(children: [
      Icon(Icons.info, color: Colors.blue), SizedBox(width: 8),
      Expanded(child: Text('Currency Transaction Reports: Mandatory for cash transactions ≥ ₦5M (NFIU directive)', style: TextStyle(fontSize: 12))),
    ]))),
    const SizedBox(height: 12),
    ..._ctrReports.map((r) => Card(child: ListTile(
      title: Text(r['customer'] as String),
      subtitle: Text('${r["type"]} | ₦${r["amount"]} | ${r["date"]}'),
      trailing: _badge(r['status'] as String),
      onTap: () {},
    ))),
  ]);

  Widget _buildSTR() => ListView(padding: const EdgeInsets.all(16), children: [
    Card(color: Colors.red.shade50, child: const Padding(padding: EdgeInsets.all(12), child: Row(children: [
      Icon(Icons.warning, color: Colors.red), SizedBox(width: 8),
      Expanded(child: Text('Suspicious Transaction Reports: Must file within 72 hours of detection (CBN AML/CFT reg)', style: TextStyle(fontSize: 12))),
    ]))),
    const SizedBox(height: 12),
    ..._strReports.map((r) => Card(child: ListTile(
      leading: CircleAvatar(backgroundColor: r['risk'] == 'high' ? Colors.red.shade50 : Colors.orange.shade50,
          child: Icon(Icons.flag, color: r['risk'] == 'high' ? Colors.red : Colors.orange)),
      title: Text(r['customer'] as String),
      subtitle: Text(r['reason'] as String),
      trailing: _badge(r['status'] as String),
    ))),
  ]);

  Widget _buildSanctions() => ListView(padding: const EdgeInsets.all(16), children: [
    const Card(child: ListTile(
      leading: Icon(Icons.shield, color: Colors.green),
      title: Text('Sanctions Screening'),
      subtitle: Text('Last updated: 2026-06-09 00:00 UTC'),
    )),
    _sanctionItem('OFAC SDN List', '12,450 entries', '2026-06-09'),
    _sanctionItem('EU Sanctions', '8,200 entries', '2026-06-08'),
    _sanctionItem('UN Security Council', '3,100 entries', '2026-06-07'),
    _sanctionItem('NFIU Watchlist', '450 entries', '2026-06-09'),
    _sanctionItem('PEP Database', '25,000 entries', '2026-06-05'),
  ]);

  Widget _sanctionItem(String name, String count, String updated) => ListTile(
    title: Text(name), subtitle: Text('$count • Updated: $updated'),
    trailing: const Icon(Icons.check_circle, color: Colors.green, size: 20),
  );

  Widget _badge(String status) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: (status == 'filed' ? Colors.green : status == 'investigating' ? Colors.orange : Colors.blue).withOpacity(0.1),
      borderRadius: BorderRadius.circular(8)),
    child: Text(status, style: TextStyle(fontSize: 11, color: status == 'filed' ? Colors.green : status == 'investigating' ? Colors.orange : Colors.blue)),
  );
}
