import 'package:flutter/material.dart';

class CardTokensScreen extends StatefulWidget {
  const CardTokensScreen({super.key});
  @override
  State<CardTokensScreen> createState() => _CardTokensScreenState();
}

class _CardTokensScreenState extends State<CardTokensScreen> {
  final List<Map<String, dynamic>> _tokens = [
    {'merchant': 'Netflix', 'last4': '4521', 'created': '2023-08-15', 'lastUsed': '2024-01-25', 'status': 'active', 'icon': Icons.play_circle},
    {'merchant': 'Spotify', 'last4': '4521', 'created': '2023-05-10', 'lastUsed': '2024-01-20', 'status': 'active', 'icon': Icons.music_note},
    {'merchant': 'Apple Pay', 'last4': '8834', 'created': '2023-11-01', 'lastUsed': '2024-01-28', 'status': 'active', 'icon': Icons.phone_iphone},
    {'merchant': 'Google Pay', 'last4': '8834', 'created': '2024-01-05', 'lastUsed': '2024-01-27', 'status': 'active', 'icon': Icons.g_mobiledata},
    {'merchant': 'Amazon', 'last4': '1122', 'created': '2022-12-01', 'lastUsed': '2023-06-15', 'status': 'suspended', 'icon': Icons.shopping_cart},
    {'merchant': 'Uber', 'last4': '4521', 'created': '2023-03-20', 'lastUsed': '2024-01-15', 'status': 'active', 'icon': Icons.local_taxi},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Card Tokens & Recurring')),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _tokens.length,
        itemBuilder: (ctx, i) {
          final t = _tokens[i];
          bool active = t['status'] == 'active';
          return Card(child: ListTile(
            leading: CircleAvatar(child: Icon(t['icon'])),
            title: Text(t['merchant']),
            subtitle: Text('Card ****${t["last4"]} | Last used: ${t["lastUsed"]}'),
            trailing: Switch(value: active, onChanged: (v) => setState(() => t['status'] = v ? 'active' : 'suspended')),
          ));
        },
      ),
    );
  }
}
