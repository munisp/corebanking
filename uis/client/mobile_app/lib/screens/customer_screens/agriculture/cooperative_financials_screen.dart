import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CooperativeFinancialsScreen extends StatelessWidget {
  const CooperativeFinancialsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Coop Financials',
      apiPath: '/api/agriculture-enhancement/cooperative-financials/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
