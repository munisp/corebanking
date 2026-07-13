import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WealthMgmtScreen extends StatelessWidget {
  const WealthMgmtScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Wealth Management',
      apiEndpoint: '/wealth/v1/portfolios',
      columnKeys: const ['id', 'client_name', 'aum', 'strategy', 'ytd_return'],
      columnLabels: const ['ID', 'Client', 'AUM', 'Strategy', 'YTD'],
      seedData: const [],
    );
  }
}
