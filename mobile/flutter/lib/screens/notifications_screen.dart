import 'package:flutter/material.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final List<Map<String, dynamic>> _notifications = [
    {'title': 'Credit Alert', 'body': '\u20A6250,000.00 received from ADEBAYO OGUN...', 'time': '2 min ago', 'type': 'credit', 'read': false},
    {'title': 'Debit Alert', 'body': '\u20A615,000.00 POS purchase at Shoprite Ikeja', 'time': '1 hour ago', 'type': 'debit', 'read': false},
    {'title': 'Security', 'body': 'New device login detected from Lagos, NG', 'time': '3 hours ago', 'type': 'security', 'read': true},
    {'title': 'Bill Due', 'body': 'DSTV subscription due tomorrow - \u20A621,000', 'time': '5 hours ago', 'type': 'bill', 'read': true},
    {'title': 'Credit Alert', 'body': '\u20A6180,000.00 salary credit from XYZ LTD', 'time': 'Yesterday', 'type': 'credit', 'read': true},
    {'title': 'Transfer Failed', 'body': '\u20A650,000 to 0012345678 failed — insufficient funds', 'time': 'Yesterday', 'type': 'failed', 'read': true},
    {'title': 'Card Expiry', 'body': 'Your Verve card ending 4521 expires in 30 days', 'time': '2 days ago', 'type': 'info', 'read': true},
  ];

  @override
  Widget build(BuildContext context) {
    int unread = _notifications.where((n) => !n['read']).length;
    return Scaffold(
      appBar: AppBar(
        title: Text('Notifications${unread > 0 ? " ($unread)" : ""}'),
        actions: [
          TextButton(onPressed: () => setState(() { for (var n in _notifications) n['read'] = true; }),
            child: const Text('Read All')),
        ],
      ),
      body: ListView.builder(
        itemCount: _notifications.length,
        itemBuilder: (ctx, i) {
          final n = _notifications[i];
          IconData icon = n['type'] == 'credit' ? Icons.arrow_downward
            : n['type'] == 'debit' ? Icons.arrow_upward
            : n['type'] == 'security' ? Icons.shield
            : n['type'] == 'bill' ? Icons.receipt
            : n['type'] == 'failed' ? Icons.error_outline : Icons.info;
          Color iconColor = n['type'] == 'credit' ? Colors.green
            : n['type'] == 'debit' ? Colors.red
            : n['type'] == 'security' ? Colors.orange
            : n['type'] == 'failed' ? Colors.red : Colors.blue;
          return Container(
            color: n['read'] ? null : Colors.blue.shade50,
            child: ListTile(
              leading: CircleAvatar(backgroundColor: iconColor.withOpacity(0.1), child: Icon(icon, color: iconColor)),
              title: Text(n['title'], style: TextStyle(fontWeight: n['read'] ? FontWeight.normal : FontWeight.bold)),
              subtitle: Text(n['body'], maxLines: 1, overflow: TextOverflow.ellipsis),
              trailing: Text(n['time'], style: const TextStyle(fontSize: 11, color: Colors.grey)),
              onTap: () => setState(() => n['read'] = true),
            ),
          );
        },
      ),
    );
  }
}
