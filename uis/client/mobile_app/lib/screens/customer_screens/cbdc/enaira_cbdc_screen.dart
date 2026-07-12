import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EnairaCbdcScreen extends StatelessWidget {
  const EnairaCbdcScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'eNaira CBDC',
      apiEndpoint: '/enaira-cbdc/v1/wallets',
      columnKeys: const ['id', 'wallet_ref', 'tier', 'balance', 'status'],
      columnLabels: const ['ID', 'Wallet', 'Tier', 'Balance', 'Status'],
      seedData: const [],
    );
  }
}
