import 'package:flutter/material.dart';

class ComponentMemoizerScreen extends StatefulWidget {
  const ComponentMemoizerScreen({super.key});
  @override
  State<ComponentMemoizerScreen> createState() => _ComponentMemoizerScreenState();
}

class _ComponentMemoizerScreenState extends State<ComponentMemoizerScreen> {
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
      appBar: AppBar(title: const Text('Component Memoizer'), backgroundColor: Colors.green[700]),
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
            _kpi('Memoized', '145', Icons.memory),
            _kpi('Cache Hit', '89%', Icons.cached),
            _kpi('Re-renders', '-45%', Icons.trending_down),
            _kpi('FPS Gain', '+12', Icons.speed),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.list, color: Colors.green),
              title: Text('Account List'),
              subtitle: Text('Memoized with key'),
              trailing: Text('89% hit', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.credit_card, color: Colors.green),
              title: Text('Transaction Card'),
              subtitle: Text('Deep compare'),
              trailing: Text('92% hit', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
