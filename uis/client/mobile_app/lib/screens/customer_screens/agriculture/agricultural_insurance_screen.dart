import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AgriculturalInsuranceScreen extends StatelessWidget {
  const AgriculturalInsuranceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Agricultural Insurance',
      apiEndpoint: '/multi-peril-crop-insurance/v1/policies',
      columnKeys: const ['id', 'farmer_name', 'crop_type', 'coverage_amount', 'status'],
      columnLabels: const ['ID', 'Farmer', 'Crop', 'Coverage', 'Status'],
      seedData: const [],
    );
  }
}
