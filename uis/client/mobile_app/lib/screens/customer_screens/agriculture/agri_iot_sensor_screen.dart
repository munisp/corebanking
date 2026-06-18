import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AgriIotSensorScreen extends StatelessWidget {
  const AgriIotSensorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'IoT Sensors',
      apiPath: '/api/agriculture-enhancement/agri-iot-sensor/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
