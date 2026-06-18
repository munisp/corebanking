import 'package:flutter/material.dart';

class FraudAlertsScreen extends StatefulWidget {
  const FraudAlertsScreen({super.key});
  @override
  State<FraudAlertsScreen> createState() => _FraudAlertsScreenState();
}

class _FraudAlertsScreenState extends State<FraudAlertsScreen> {
  final List<Map<String, dynamic>> _alerts = [
    {'title': 'New device login', 'description': 'Login from iPhone 15 Pro in Lagos', 'time': '2 min ago', 'read': false, 'severity': 'info'},
    {'title': 'Large transfer attempted', 'description': '\u20A64.5M to new beneficiary — blocked pending verification', 'time': '15 min ago', 'read': false, 'severity': 'warning'},
    {'title': 'Card used internationally', 'description': 'POS transaction in London, UK — \u20A6125,000', 'time': '1 hour ago', 'read': true, 'severity': 'info'},
    {'title': 'Multiple failed PINs', 'description': '3 failed ATM PIN attempts at Ikoyi branch', 'time': '3 hours ago', 'read': true, 'severity': 'critical'},
    {'title': 'Unusual time activity', 'description': 'Transfer of \u20A6800K at 3:22 AM', 'time': '5 hours ago', 'read': true, 'severity': 'warning'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Fraud Alerts'), actions: [
        TextButton(onPressed: () => setState(() { for (var a in _alerts) a['read'] = true; }),
          child: const Text('Mark all read')),
      ]),
      body: ListView.builder(
        itemCount: _alerts.length,
        itemBuilder: (ctx, i) {
          final a = _alerts[i];
          Color sevColor = a['severity'] == 'critical' ? Colors.red : a['severity'] == 'warning' ? Colors.orange : Colors.blue;
          return Container(
            color: a['read'] ? null : Colors.blue.shade50,
            child: ListTile(
              leading: CircleAvatar(backgroundColor: sevColor.withOpacity(0.2),
                child: Icon(a['severity'] == 'critical' ? Icons.error : Icons.warning, color: sevColor)),
              title: Text(a['title'], style: TextStyle(fontWeight: a['read'] ? FontWeight.normal : FontWeight.bold)),
              subtitle: Text(a['description']),
              trailing: Text(a['time'], style: const TextStyle(fontSize: 11, color: Colors.grey)),
              onTap: () => setState(() => a['read'] = true),
            ),
          );
        },
      ),
    );
  }
}
