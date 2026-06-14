import 'package:flutter/material.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final Map<String, dynamic> _profile = {
    'name': 'Adewale Okafor',
    'email': 'adewale.okafor@email.com',
    'phone': '+234 801 234 5678',
    'bvn': '22*****89',
    'nin': '12*****34',
    'kycTier': 3,
    'accountType': 'Savings',
    'accountNumber': '0123456789',
    'dateOpened': '2024-03-15',
    'branch': 'Victoria Island, Lagos',
  };

  Widget _infoTile(String label, String value, {IconData? icon}) {
    return ListTile(
      leading: Icon(icon ?? Icons.info_outline, color: Colors.green[700], size: 20),
      title: Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
      subtitle: Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Profile'), backgroundColor: Colors.green[700]),
      body: SingleChildScrollView(
        child: Column(children: [
          Container(
            width: double.infinity, padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(color: Colors.green[700]),
            child: Column(children: [
              CircleAvatar(radius: 40, backgroundColor: Colors.white,
                child: Text(_profile['name'].toString().split(' ').map((n) => n[0]).join(),
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.green[700]))),
              const SizedBox(height: 12),
              Text(_profile['name']!, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 4),
              Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(color: Colors.green[600], borderRadius: BorderRadius.circular(12)),
                child: Text('KYC Tier ${_profile["kycTier"]}', style: const TextStyle(color: Colors.white, fontSize: 12))),
            ]),
          ),
          Card(margin: const EdgeInsets.all(16), child: Column(children: [
            _infoTile('Account Number', _profile['accountNumber']!, icon: Icons.account_balance),
            const Divider(height: 1),
            _infoTile('Account Type', _profile['accountType']!, icon: Icons.category),
            const Divider(height: 1),
            _infoTile('Branch', _profile['branch']!, icon: Icons.location_on),
            const Divider(height: 1),
            _infoTile('Date Opened', _profile['dateOpened']!, icon: Icons.calendar_today),
          ])),
          Card(margin: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: [
            _infoTile('Email', _profile['email']!, icon: Icons.email),
            const Divider(height: 1),
            _infoTile('Phone', _profile['phone']!, icon: Icons.phone),
            const Divider(height: 1),
            _infoTile('BVN', _profile['bvn']!, icon: Icons.fingerprint),
            const Divider(height: 1),
            _infoTile('NIN', _profile['nin']!, icon: Icons.badge),
          ])),
          Padding(padding: const EdgeInsets.all(16), child: Column(children: [
            ListTile(leading: Icon(Icons.security, color: Colors.green[700]),
              title: const Text('Security Settings'), trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.pushNamed(context, '/settings')),
            ListTile(leading: Icon(Icons.upload_file, color: Colors.green[700]),
              title: const Text('Upload Documents'), trailing: const Icon(Icons.chevron_right),
              onTap: () {}),
            ListTile(leading: Icon(Icons.logout, color: Colors.red[700]),
              title: Text('Logout', style: TextStyle(color: Colors.red[700])),
              onTap: () => Navigator.pushReplacementNamed(context, '/login')),
          ])),
        ]),
      ),
    );
  }
}
