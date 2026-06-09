import 'package:flutter/material.dart';

class NotificationPrefsScreen extends StatefulWidget {
  const NotificationPrefsScreen({super.key});
  @override
  State<NotificationPrefsScreen> createState() => _NotificationPrefsScreenState();
}

class _NotificationPrefsScreenState extends State<NotificationPrefsScreen> {
  final Map<String, Map<String, bool>> _prefs = {
    'Credit Alerts': {'push': true, 'sms': true, 'email': true, 'whatsapp': true},
    'Debit Alerts': {'push': true, 'sms': true, 'email': false, 'whatsapp': true},
    'Login Alerts': {'push': true, 'sms': false, 'email': true, 'whatsapp': false},
    'Bill Reminders': {'push': true, 'sms': false, 'email': true, 'whatsapp': false},
    'Promotions': {'push': false, 'sms': false, 'email': true, 'whatsapp': false},
    'Card Alerts': {'push': true, 'sms': true, 'email': false, 'whatsapp': false},
    'Loan Updates': {'push': true, 'sms': false, 'email': true, 'whatsapp': false},
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notification Preferences')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: const [
            SizedBox(width: 140),
            SizedBox(width: 50, child: Center(child: Icon(Icons.notifications, size: 18))),
            SizedBox(width: 50, child: Center(child: Icon(Icons.sms, size: 18))),
            SizedBox(width: 50, child: Center(child: Icon(Icons.email, size: 18))),
            SizedBox(width: 50, child: Center(child: Text('WA', style: TextStyle(fontSize: 12)))),
          ]),
          const Divider(),
          ..._prefs.entries.map((entry) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(children: [
              SizedBox(width: 140, child: Text(entry.key, style: const TextStyle(fontSize: 13))),
              SizedBox(width: 50, child: Checkbox(value: entry.value['push'],
                onChanged: (v) => setState(() => entry.value['push'] = v!))),
              SizedBox(width: 50, child: Checkbox(value: entry.value['sms'],
                onChanged: (v) => setState(() => entry.value['sms'] = v!))),
              SizedBox(width: 50, child: Checkbox(value: entry.value['email'],
                onChanged: (v) => setState(() => entry.value['email'] = v!))),
              SizedBox(width: 50, child: Checkbox(value: entry.value['whatsapp'],
                onChanged: (v) => setState(() => entry.value['whatsapp'] = v!))),
            ]),
          )),
          const SizedBox(height: 24),
          const Text('Quiet Hours', style: TextStyle(fontWeight: FontWeight.bold)),
          SwitchListTile(title: const Text('Enable quiet hours'), subtitle: const Text('No push/SMS between 10PM - 7AM'),
            value: true, onChanged: (v) {}),
          const Divider(),
          const Text('Minimum Alert Amount', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text('Only send debit alerts for amounts above:', style: TextStyle(color: Colors.grey)),
          Slider(min: 0, max: 100000, value: 5000, divisions: 20,
            label: '\u20A65,000', onChanged: (v) {}),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Preferences saved'))),
            child: const Text('Save Preferences'))),
        ]),
      ),
    );
  }
}
