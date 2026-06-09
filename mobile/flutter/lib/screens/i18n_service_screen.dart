import 'package:flutter/material.dart';

class I18NServiceScreen extends StatefulWidget {
  const I18NServiceScreen({super.key});
  @override
  State<I18NServiceScreen> createState() => _I18NServiceScreenState();
}

class _I18NServiceScreenState extends State<I18NServiceScreen> {
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
      appBar: AppBar(title: const Text('I18N Service'), backgroundColor: Colors.green[700]),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.6,
              children: [
              _kpi('Languages', '4', Icons.translate),
              _kpi('Strings', '8,500', Icons.text_fields),
              _kpi('Translated', '100%', Icons.check),
              _kpi('Missing', '0', Icons.warning),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('English (en-NG)'),
              subtitle: Text('Primary'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('8,500 strings', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Complete', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Hausa (ha-NG)'),
              subtitle: Text('Secondary'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('8,500 strings', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Complete', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Yoruba (yo-NG)'),
              subtitle: Text('Secondary'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('8,500 strings', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Complete', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Igbo (ig-NG)'),
              subtitle: Text('Secondary'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('8,500 strings', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Complete', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
