import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class NirsalCreditGuaranteeScreen extends StatelessWidget {
  const NirsalCreditGuaranteeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'NIRSAL Credit Guarantee',
      apiPath: '/api/agriculture-enhancement/nirsal-credit-guarantee/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
