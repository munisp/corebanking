import 'package:flutter/material.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});
  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  final List<Map<String, dynamic>> _kpis = [
    {'label': 'Active Accounts', 'value': '2.4M', 'change': '+3.2%', 'icon': Icons.people},
    {'label': 'Daily Transactions', 'value': '890K', 'change': '+12.5%', 'icon': Icons.swap_horiz},
    {'label': 'Total Deposits', 'value': '\u20A6847B', 'change': '+5.1%', 'icon': Icons.account_balance},
    {'label': 'NPL Ratio', 'value': '3.2%', 'change': '-0.4%', 'icon': Icons.trending_down},
    {'label': 'System Uptime', 'value': '99.97%', 'change': '+0.02%', 'icon': Icons.cloud_done},
    {'label': 'Fraud Blocked', 'value': '\u20A612.3M', 'change': '+8.7%', 'icon': Icons.shield},
  ];

  final List<Map<String, dynamic>> _alerts = [
    {'severity': 'critical', 'message': 'NIBSS switch latency >500ms', 'time': '2m ago'},
    {'severity': 'warning', 'message': 'KYC queue backlog: 1,234 pending', 'time': '15m ago'},
    {'severity': 'info', 'message': 'Scheduled maintenance: TigerBeetle upgrade 2AM', 'time': '1h ago'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Admin Dashboard'), actions: [
        IconButton(icon: const Icon(Icons.refresh), onPressed: () => setState(() {})),
        IconButton(icon: const Icon(Icons.notifications_active), onPressed: () {}),
      ]),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2, childAspectRatio: 1.6, crossAxisSpacing: 12, mainAxisSpacing: 12),
              itemCount: _kpis.length,
              itemBuilder: (ctx, i) => Card(child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Icon(_kpis[i]['icon'], size: 20, color: Colors.blue),
                    const Spacer(),
                    Text(_kpis[i]['change'], style: TextStyle(
                      color: _kpis[i]['change'].startsWith('+') ? Colors.green : Colors.red, fontSize: 12)),
                  ]),
                  const Spacer(),
                  Text(_kpis[i]['value'], style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  Text(_kpis[i]['label'], style: const TextStyle(color: Colors.grey, fontSize: 12)),
                ]),
              )),
            ),
            const SizedBox(height: 24),
            const Text('System Alerts', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...List.generate(_alerts.length, (i) => Card(
              color: _alerts[i]['severity'] == 'critical' ? Colors.red.shade50
                : _alerts[i]['severity'] == 'warning' ? Colors.orange.shade50 : Colors.blue.shade50,
              child: ListTile(
                leading: Icon(
                  _alerts[i]['severity'] == 'critical' ? Icons.error : Icons.warning,
                  color: _alerts[i]['severity'] == 'critical' ? Colors.red : Colors.orange,
                ),
                title: Text(_alerts[i]['message']),
                trailing: Text(_alerts[i]['time'], style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ),
            )),
          ],
        ),
      ),
    );
  }
}
