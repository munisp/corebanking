import 'package:flutter/material.dart';

class NotificationCenterScreen extends StatefulWidget {
  const NotificationCenterScreen({super.key});
  @override
  State<NotificationCenterScreen> createState() => _NotificationCenterScreenState();
}

class _NotificationCenterScreenState extends State<NotificationCenterScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _pushEnabled = true;
  bool _smsEnabled = true;
  bool _emailEnabled = true;
  bool _transactionAlerts = true;
  bool _securityAlerts = true;
  bool _promotions = false;
  bool _loanReminders = true;

  final _notifications = [
    {'id': 1, 'title': 'Transfer Successful', 'body': 'NGN 50,000 sent to John Doe (0123456789). Ref: TXN-10001', 'type': 'transaction', 'time': '2 min ago', 'read': false},
    {'id': 2, 'title': 'Security Alert', 'body': 'New login detected from Lagos, Nigeria (Chrome/Windows)', 'type': 'security', 'time': '15 min ago', 'read': false},
    {'id': 3, 'title': 'Loan Payment Due', 'body': 'Your Personal Loan payment of NGN 45,833 is due on Jul 15', 'type': 'reminder', 'time': '1 hour ago', 'read': true},
    {'id': 4, 'title': 'Salary Credited', 'body': 'NGN 350,000 credited from ABC Ltd. Balance: NGN 550,000', 'type': 'transaction', 'time': '5 hours ago', 'read': true},
    {'id': 5, 'title': 'Card Blocked', 'body': 'Your debit card ending 4523 has been temporarily blocked due to suspicious activity', 'type': 'security', 'time': 'Yesterday', 'read': true},
    {'id': 6, 'title': 'Savings Goal Reached!', 'body': 'Congratulations! Your Vacation savings goal of NGN 500,000 is complete', 'type': 'achievement', 'time': 'Yesterday', 'read': true},
    {'id': 7, 'title': 'Bill Payment Failed', 'body': 'DSTV subscription payment failed. Insufficient funds.', 'type': 'transaction', 'time': '2 days ago', 'read': true},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  int get _unreadCount => _notifications.where((n) => n['read'] == false).length;

  IconData _typeIcon(String type) {
    switch (type) {
      case 'transaction': return Icons.swap_horiz;
      case 'security': return Icons.shield;
      case 'reminder': return Icons.alarm;
      case 'achievement': return Icons.emoji_events;
      default: return Icons.notifications;
    }
  }

  Color _typeColor(String type) {
    switch (type) {
      case 'transaction': return Colors.blue;
      case 'security': return Colors.red;
      case 'reminder': return Colors.orange;
      case 'achievement': return Colors.green;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (_unreadCount > 0)
            TextButton(onPressed: () => setState(() {
              for (final n in _notifications) { n['read'] = true; }
            }), child: const Text('Mark all read')),
        ],
        bottom: TabBar(controller: _tabController, tabs: const [
          Tab(text: 'Inbox'),
          Tab(text: 'Preferences'),
        ]),
      ),
      body: TabBarView(controller: _tabController, children: [
        _buildInbox(),
        _buildPreferences(),
      ]),
    );
  }

  Widget _buildInbox() {
    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: _notifications.length,
      itemBuilder: (ctx, i) {
        final n = _notifications[i];
        final isRead = n['read'] as bool;
        return Dismissible(
          key: ValueKey(n['id']),
          direction: DismissDirection.endToStart,
          background: Container(color: Colors.red, alignment: Alignment.centerRight,
            padding: const EdgeInsets.only(right: 16), child: const Icon(Icons.delete, color: Colors.white)),
          onDismissed: (_) => setState(() => _notifications.removeAt(i)),
          child: Card(
            color: isRead ? null : Theme.of(context).colorScheme.primaryContainer.withAlpha(50),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: _typeColor(n['type'] as String).withAlpha(30),
                child: Icon(_typeIcon(n['type'] as String), color: _typeColor(n['type'] as String), size: 20),
              ),
              title: Row(children: [
                if (!isRead) Container(width: 8, height: 8, margin: const EdgeInsets.only(right: 8),
                  decoration: BoxDecoration(shape: BoxShape.circle, color: Theme.of(context).colorScheme.primary)),
                Expanded(child: Text(n['title'] as String, style: TextStyle(fontWeight: isRead ? FontWeight.normal : FontWeight.bold))),
              ]),
              subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const SizedBox(height: 4),
                Text(n['body'] as String, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                Text(n['time'] as String, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
              ]),
              onTap: () => setState(() => n['read'] = true),
            ),
          ),
        );
      },
    );
  }

  Widget _buildPreferences() {
    return ListView(padding: const EdgeInsets.all(16), children: [
      const Text('Notification Channels', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      SwitchListTile(title: const Text('Push Notifications'), subtitle: const Text('Receive push notifications on this device'),
        value: _pushEnabled, onChanged: (v) => setState(() => _pushEnabled = v)),
      SwitchListTile(title: const Text('SMS Alerts'), subtitle: const Text('Receive SMS for critical transactions'),
        value: _smsEnabled, onChanged: (v) => setState(() => _smsEnabled = v)),
      SwitchListTile(title: const Text('Email Notifications'), subtitle: const Text('Receive email summaries and statements'),
        value: _emailEnabled, onChanged: (v) => setState(() => _emailEnabled = v)),
      const Divider(height: 32),
      const Text('Notification Types', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      SwitchListTile(title: const Text('Transaction Alerts'), subtitle: const Text('Debits, credits, and payment confirmations'),
        value: _transactionAlerts, onChanged: (v) => setState(() => _transactionAlerts = v)),
      SwitchListTile(title: const Text('Security Alerts'), subtitle: const Text('Login attempts, password changes, device changes'),
        value: _securityAlerts, onChanged: (v) => setState(() => _securityAlerts = v)),
      SwitchListTile(title: const Text('Loan Reminders'), subtitle: const Text('Payment due dates and loan updates'),
        value: _loanReminders, onChanged: (v) => setState(() => _loanReminders = v)),
      SwitchListTile(title: const Text('Promotions & Offers'), subtitle: const Text('Special rates, new products, and campaigns'),
        value: _promotions, onChanged: (v) => setState(() => _promotions = v)),
    ]);
  }
}
