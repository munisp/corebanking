import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AgriLogisticsScreen extends StatelessWidget {
  const AgriLogisticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Agri Logistics',
      apiPath: '/api/agriculture-enhancement/agri-logistics/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
