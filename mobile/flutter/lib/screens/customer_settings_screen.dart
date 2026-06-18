import 'package:flutter/material.dart';

class CustomerSettingsScreen extends StatefulWidget {
  const CustomerSettingsScreen({super.key});
  @override
  State<CustomerSettingsScreen> createState() => _CustomerSettingsScreenState();
}

class _CustomerSettingsScreenState extends State<CustomerSettingsScreen> {
  bool _biometricLogin = true;
  bool _pushNotifications = true;
  bool _smsAlerts = true;
  bool _emailAlerts = false;
  bool _darkMode = false;
  String _language = 'English';
  String _currency = 'NGN';
  double _transferLimit = 1000000;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(children: [
        _sectionHeader('Security'),
        SwitchListTile(title: const Text('Biometric Login'), subtitle: const Text('Use fingerprint or face ID'),
          value: _biometricLogin, onChanged: (v) => setState(() => _biometricLogin = v), secondary: const Icon(Icons.fingerprint)),
        ListTile(leading: const Icon(Icons.lock), title: const Text('Change PIN'), subtitle: const Text('4-digit transaction PIN'), trailing: const Icon(Icons.chevron_right), onTap: () {}),
        ListTile(leading: const Icon(Icons.password), title: const Text('Change Password'), trailing: const Icon(Icons.chevron_right), onTap: () {}),
        ListTile(leading: const Icon(Icons.devices), title: const Text('Manage Devices'), subtitle: const Text('2 devices linked'), trailing: const Icon(Icons.chevron_right), onTap: () {}),
        _sectionHeader('Notifications'),
        SwitchListTile(title: const Text('Push Notifications'), value: _pushNotifications,
          onChanged: (v) => setState(() => _pushNotifications = v), secondary: const Icon(Icons.notifications)),
        SwitchListTile(title: const Text('SMS Alerts'), subtitle: const Text('₦4 per alert'), value: _smsAlerts,
          onChanged: (v) => setState(() => _smsAlerts = v), secondary: const Icon(Icons.sms)),
        SwitchListTile(title: const Text('Email Alerts'), value: _emailAlerts,
          onChanged: (v) => setState(() => _emailAlerts = v), secondary: const Icon(Icons.email)),
        _sectionHeader('Preferences'),
        SwitchListTile(title: const Text('Dark Mode'), value: _darkMode,
          onChanged: (v) => setState(() => _darkMode = v), secondary: const Icon(Icons.dark_mode)),
        ListTile(leading: const Icon(Icons.language), title: const Text('Language'), trailing: DropdownButton<String>(value: _language,
          items: ['English', 'Yoruba', 'Hausa', 'Igbo', 'Pidgin'].map((l) => DropdownMenuItem(value: l, child: Text(l))).toList(),
          onChanged: (v) => setState(() => _language = v!))),
        ListTile(leading: const Icon(Icons.currency_exchange), title: const Text('Display Currency'), trailing: DropdownButton<String>(value: _currency,
          items: ['NGN', 'USD', 'GBP', 'EUR'].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
          onChanged: (v) => setState(() => _currency = v!))),
        _sectionHeader('Limits'),
        ListTile(leading: const Icon(Icons.speed), title: const Text('Daily Transfer Limit'),
          subtitle: Slider(value: _transferLimit, min: 100000, max: 5000000, divisions: 49,
            label: '₦${(_transferLimit / 100).toStringAsFixed(0)}',
            onChanged: (v) => setState(() => _transferLimit = v))),
        _sectionHeader('Account'),
        ListTile(leading: const Icon(Icons.description), title: const Text('Terms & Conditions'), trailing: const Icon(Icons.chevron_right), onTap: () {}),
        ListTile(leading: const Icon(Icons.privacy_tip), title: const Text('Privacy Policy'), trailing: const Icon(Icons.chevron_right), onTap: () {}),
        ListTile(leading: Icon(Icons.delete_forever, color: Colors.red[400]), title: Text('Close Account', style: TextStyle(color: Colors.red[400])), onTap: () {}),
        const SizedBox(height: 20),
        Padding(padding: const EdgeInsets.all(16), child: Text('App Version 3.2.1 (Build 567)', style: TextStyle(color: Colors.grey[500]), textAlign: TextAlign.center)),
      ]),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.grey[600])));
  }
}
