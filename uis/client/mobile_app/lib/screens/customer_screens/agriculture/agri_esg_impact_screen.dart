import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AgriEsgImpactScreen extends StatelessWidget {
  const AgriEsgImpactScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'ESG Impact',
      apiPath: '/api/agriculture-enhancement/agri-esg-impact/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
