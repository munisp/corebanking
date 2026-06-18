import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AgriReinsuranceScreen extends StatelessWidget {
  const AgriReinsuranceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Agri Reinsurance',
      apiPath: '/api/agriculture-enhancement/agri-reinsurance/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
