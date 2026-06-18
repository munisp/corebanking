import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CooperativeCreditScoringScreen extends StatelessWidget {
  const CooperativeCreditScoringScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CoopScore',
      apiPath: '/api/agriculture-enhancement/cooperative-credit-scoring/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
