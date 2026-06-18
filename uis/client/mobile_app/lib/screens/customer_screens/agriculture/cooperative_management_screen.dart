import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CooperativeManagementScreen extends StatelessWidget {
  const CooperativeManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Cooperative Management',
      apiPath: '/api/agriculture-enhancement/cooperative-management/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
