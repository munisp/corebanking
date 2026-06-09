import 'package:flutter/material.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _twoFactorAuth = true;
  bool _sessionTimeout = true;
  int _sessionMinutes = 15;
  bool _ipWhitelist = false;
  bool _auditLogging = true;
  String _dateFormat = 'DD/MM/YYYY';
  String _timezone = 'Africa/Lagos (WAT)';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('System Settings')),
      body: ListView(children: [
        _sectionHeader('Security'),
        SwitchListTile(title: const Text('Two-Factor Authentication'), subtitle: const Text('Require TOTP for admin access'),
          value: _twoFactorAuth, onChanged: (v) => setState(() => _twoFactorAuth = v), secondary: const Icon(Icons.security)),
        SwitchListTile(title: const Text('Session Auto-Timeout'), subtitle: Text('Logout after $_sessionMinutes minutes of inactivity'),
          value: _sessionTimeout, onChanged: (v) => setState(() => _sessionTimeout = v), secondary: const Icon(Icons.timer)),
        if (_sessionTimeout) ListTile(title: Slider(value: _sessionMinutes.toDouble(), min: 5, max: 60, divisions: 11,
          label: '$_sessionMinutes min', onChanged: (v) => setState(() => _sessionMinutes = v.round()))),
        SwitchListTile(title: const Text('IP Whitelist'), subtitle: const Text('Restrict admin access to approved IPs'),
          value: _ipWhitelist, onChanged: (v) => setState(() => _ipWhitelist = v), secondary: const Icon(Icons.vpn_lock)),
        SwitchListTile(title: const Text('Audit Logging'), subtitle: const Text('Log all admin actions (CBN requirement)'),
          value: _auditLogging, onChanged: (v) => setState(() => _auditLogging = v), secondary: const Icon(Icons.history)),
        _sectionHeader('Regional'),
        ListTile(leading: const Icon(Icons.calendar_today), title: const Text('Date Format'),
          trailing: DropdownButton<String>(value: _dateFormat,
            items: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((f) => DropdownMenuItem(value: f, child: Text(f))).toList(),
            onChanged: (v) => setState(() => _dateFormat = v!))),
        ListTile(leading: const Icon(Icons.public), title: const Text('Timezone'), subtitle: Text(_timezone)),
        _sectionHeader('System'),
        ListTile(leading: const Icon(Icons.storage), title: const Text('Database Status'), subtitle: const Text('PostgreSQL 16.1 | 234 GB used'), trailing: const Icon(Icons.check_circle, color: Colors.green)),
        ListTile(leading: const Icon(Icons.memory), title: const Text('Cache Status'), subtitle: const Text('Redis Cluster | 48 GB | 99.9% hit rate'), trailing: const Icon(Icons.check_circle, color: Colors.green)),
        ListTile(leading: const Icon(Icons.cloud), title: const Text('API Gateway'), subtitle: const Text('APISIX 3.8 | 12,500 req/s'), trailing: const Icon(Icons.check_circle, color: Colors.green)),
        _sectionHeader('Maintenance'),
        ListTile(leading: const Icon(Icons.backup), title: const Text('Backup Schedule'), subtitle: const Text('Daily at 02:00 WAT | Last: Jan 15, 2024'), trailing: const Icon(Icons.chevron_right), onTap: () {}),
        ListTile(leading: const Icon(Icons.update), title: const Text('System Updates'), subtitle: const Text('Version 3.2.1 | Up to date'), trailing: const Icon(Icons.chevron_right), onTap: () {}),
      ]),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.grey[600])));
  }
}
