import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AgriSavingsCyclesScreen extends StatelessWidget {
  const AgriSavingsCyclesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Savings Cycles',
      apiPath: '/api/agriculture-enhancement/agri-savings-cycles/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
