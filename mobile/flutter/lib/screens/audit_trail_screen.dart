import 'package:flutter/material.dart';

class AuditTrailScreen extends StatefulWidget {
  const AuditTrailScreen({super.key});
  @override
  State<AuditTrailScreen> createState() => _AuditTrailScreenState();
}

class _AuditTrailScreenState extends State<AuditTrailScreen> {
  final List<Map<String, dynamic>> _events = [
    {'action': 'LOGIN', 'user': 'admin@54bank.ng', 'ip': '102.89.45.12', 'time': '2024-01-28 14:32:05', 'device': 'Chrome/Windows'},
    {'action': 'TRANSFER_APPROVED', 'user': 'ops@54bank.ng', 'ip': '102.89.45.15', 'time': '2024-01-28 14:28:12', 'device': 'Safari/MacOS'},
    {'action': 'ROLE_CHANGED', 'user': 'admin@54bank.ng', 'ip': '102.89.45.12', 'time': '2024-01-28 13:45:00', 'device': 'Chrome/Windows'},
    {'action': 'ACCOUNT_CREATED', 'user': 'cso@54bank.ng', 'ip': '192.168.1.50', 'time': '2024-01-28 12:15:33', 'device': 'Edge/Windows'},
    {'action': 'PASSWORD_RESET', 'user': 'user123@gmail.com', 'ip': '105.112.45.89', 'time': '2024-01-28 11:05:22', 'device': 'Mobile/Android'},
    {'action': 'FAILED_LOGIN', 'user': 'unknown@test.com', 'ip': '185.220.101.5', 'time': '2024-01-28 03:22:11', 'device': 'Unknown'},
    {'action': 'CONFIG_CHANGED', 'user': 'admin@54bank.ng', 'ip': '102.89.45.12', 'time': '2024-01-27 16:00:00', 'device': 'Chrome/Windows'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Audit Trail'), actions: [
        IconButton(icon: const Icon(Icons.filter_list), onPressed: () {}),
        IconButton(icon: const Icon(Icons.download), onPressed: () {}),
      ]),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _events.length,
        itemBuilder: (ctx, i) {
          final e = _events[i];
          Color actionColor = e['action'].contains('FAILED') ? Colors.red
            : e['action'].contains('APPROVED') || e['action'].contains('CREATED') ? Colors.green
            : e['action'].contains('CHANGED') || e['action'].contains('RESET') ? Colors.orange : Colors.blue;
          return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: actionColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                  child: Text(e['action'], style: TextStyle(color: actionColor, fontSize: 11, fontWeight: FontWeight.bold))),
                const Spacer(),
                Text(e['time'], style: const TextStyle(fontSize: 11, color: Colors.grey)),
              ]),
              const SizedBox(height: 8),
              Row(children: [
                const Icon(Icons.person, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Text(e['user'], style: const TextStyle(fontSize: 13)),
              ]),
              const SizedBox(height: 4),
              Row(children: [
                const Icon(Icons.computer, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Text('${e["ip"]} | ${e["device"]}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ]),
            ],
          )));
        },
      ),
    );
  }
}
