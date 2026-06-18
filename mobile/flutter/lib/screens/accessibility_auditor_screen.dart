import 'package:flutter/material.dart';

class AccessibilityAuditorScreen extends StatefulWidget {
  const AccessibilityAuditorScreen({super.key});
  @override
  State<AccessibilityAuditorScreen> createState() => _AccessibilityAuditorScreenState();
}

class _AccessibilityAuditorScreenState extends State<AccessibilityAuditorScreen> {
  bool _isLoading = false;

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
      appBar: AppBar(title: const Text('Accessibility Auditor'), backgroundColor: Colors.green[700]),
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
            _kpi('WCAG Score', '92/100', Icons.accessibility),
            _kpi('Issues', '8', Icons.warning),
            _kpi('Screens', '567', Icons.phone_android),
            _kpi('Contrast', '98%', Icons.format_color_fill),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.image, color: Colors.green),
              title: Text('Missing alt text'),
              subtitle: Text('3 screens'),
              trailing: Text('High', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.format_color_fill, color: Colors.green),
              title: Text('Low contrast'),
              subtitle: Text('Secondary text'),
              trailing: Text('Medium', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
