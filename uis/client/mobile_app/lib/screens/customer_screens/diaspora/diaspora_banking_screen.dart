import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DiasporaBankingScreen extends StatelessWidget {
  const DiasporaBankingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Diaspora Banking',
      apiEndpoint: '/diaspora/v1/accounts',
      columnKeys: const ['id', 'account_name', 'country', 'account_type', 'balance'],
      columnLabels: const ['ID', 'Name', 'Country', 'Type', 'Balance'],
      seedData: const [],
    );
  }
}
