import 'package:flutter/material.dart';

class AvroSchemaRegistryScreen extends StatefulWidget {
  const AvroSchemaRegistryScreen({super.key});
  @override
  State<AvroSchemaRegistryScreen> createState() => _AvroSchemaRegistryScreenState();
}

class _AvroSchemaRegistryScreenState extends State<AvroSchemaRegistryScreen> {
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
      appBar: AppBar(title: const Text('Avro Schema Registry'), backgroundColor: Colors.green[700]),
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
            _kpi('Schemas', '145', Icons.schema),
            _kpi('Versions', '312', Icons.layers),
            _kpi('Subjects', '89', Icons.topic),
            _kpi('Compat', 'BACKWARD', Icons.check),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.event, color: Colors.green),
              title: Text('transaction-events'),
              subtitle: Text('v3, 12 fields'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.person, color: Colors.green),
              title: Text('customer-events'),
              subtitle: Text('v2, 8 fields'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.history, color: Colors.green),
              title: Text('audit-log'),
              subtitle: Text('v1, 15 fields'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
