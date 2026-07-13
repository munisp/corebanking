import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AgriEvoucherScreen extends StatelessWidget {
  const AgriEvoucherScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Agri E-Voucher',
      apiPath: '/api/agriculture-enhancement/agri-evoucher/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
