import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AgriInputMarketplaceScreen extends StatelessWidget {
  const AgriInputMarketplaceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Input Marketplace',
      apiPath: '/api/agriculture-enhancement/agri-input-marketplace/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
