import 'package:flutter/material.dart';

class AgriIotSensorScreen extends StatefulWidget {
  const AgriIotSensorScreen({super.key});
  @override
  State<AgriIotSensorScreen> createState() => _AgriIotSensorScreenState();
}

class _AgriIotSensorScreenState extends State<AgriIotSensorScreen> {
  final List<Map<String, dynamic>> _sensors = [
    {'id': 'SNS-001', 'farm': 'Ogun Rice Farm', 'type': 'Soil Moisture', 'value': '42%', 'status': 'Normal', 'battery': 85},
    {'id': 'SNS-002', 'farm': 'Ogun Rice Farm', 'type': 'Temperature', 'value': '28°C', 'status': 'Normal', 'battery': 92},
    {'id': 'SNS-003', 'farm': 'Kaduna Maize Cluster', 'type': 'Soil pH', 'value': '5.8', 'status': 'Warning', 'battery': 67},
    {'id': 'SNS-004', 'farm': 'Kaduna Maize Cluster', 'type': 'Rainfall', 'value': '2.3mm', 'status': 'Normal', 'battery': 78},
    {'id': 'SNS-005', 'farm': 'Benue Soybean', 'type': 'Humidity', 'value': '72%', 'status': 'High', 'battery': 15},
    {'id': 'SNS-006', 'farm': 'Kano Groundnut', 'type': 'Wind Speed', 'value': '12km/h', 'status': 'Normal', 'battery': 90},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('IoT Sensors'), backgroundColor: Colors.green[800]),
      body: ListView.builder(itemCount: _sensors.length, itemBuilder: (ctx, i) {
        final s = _sensors[i];
        final statusColor = s['status'] == 'Normal' ? Colors.green : s['status'] == 'Warning' ? Colors.orange : Colors.red;
        return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ListTile(
          leading: CircleAvatar(backgroundColor: statusColor.withOpacity(0.1), child: Icon(Icons.sensors, color: statusColor)),
          title: Text('${s["id"]} - ${s["type"]}'), subtitle: Text('${s["farm"]} | Value: ${s["value"]}'),
          trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(s['value'] as String, style: TextStyle(fontWeight: FontWeight.bold, color: statusColor)),
            Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.battery_std, size: 14, color: (s['battery'] as int) > 20 ? Colors.green : Colors.red),
              Text('${s["battery"]}%', style: const TextStyle(fontSize: 11)),
            ]),
          ]),
        ));
      }),
    );
  }
}
