import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RemittanceScreen extends StatelessWidget {
  const RemittanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Remittance',
      apiEndpoint: '/remittance/v1/transfers',
      columnKeys: const ['id', 'sender_name', 'beneficiary_name', 'amount', 'corridor'],
      columnLabels: const ['ID', 'Sender', 'Receiver', 'Amount', 'Corridor'],
      seedData: const [],
    );
  }
}
