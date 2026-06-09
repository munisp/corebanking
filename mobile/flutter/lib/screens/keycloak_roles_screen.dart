import 'package:flutter/material.dart';

class KeycloakRolesScreen extends StatefulWidget {
  const KeycloakRolesScreen({super.key});
  @override
  State<KeycloakRolesScreen> createState() => _KeycloakRolesScreenState();
}

class _KeycloakRolesScreenState extends State<KeycloakRolesScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'name': 'Password + TOTP', 'type': '2FA', 'value': '85% of users', 'status': 'Active'},
    {'name': 'WebAuthn/FIDO2', 'type': 'Passwordless', 'value': '12% of users', 'status': 'Active'},
    {'name': 'Social Login (Google/Apple)', 'type': 'Federation', 'value': '45K users', 'status': 'Active'},
    {'name': 'Enterprise SSO (SAML)', 'type': 'Corporate', 'value': '8 organizations', 'status': 'Active'},
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  Widget _kpi(String label, String value, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Colors.green[700], size: 20),
            const Spacer(),
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Keycloak Roles'), backgroundColor: Colors.green[700]),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.6,
              children: [
              _kpi('Active Sessions', '125K', Icons.people),
              _kpi('Auth/Min', '8,500', Icons.login),
              _kpi('MFA Enabled', '85%', Icons.security),
              _kpi('SSO Providers', '12', Icons.key),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: InputDecoration(
                hintText: 'Search keycloak roles...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onChanged: (v) => setState(() => _searchQuery = v),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: ListView.builder(
                itemCount: _filteredItems.length,
                itemBuilder: (context, index) {
                  final item = _filteredItems[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: Colors.green[100],
                        child: Text(item['name'].toString().substring(0, 1)),
                      ),
                      title: Text(item['name'].toString()),
                      subtitle: Text('${item['type']} — ${item['value']}'),
                      trailing: Chip(
                        label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                        backgroundColor: item['status'] == 'Active' ? Colors.green[100] : Colors.orange[100],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
