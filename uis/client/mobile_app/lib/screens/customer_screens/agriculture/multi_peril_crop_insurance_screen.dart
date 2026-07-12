import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MultiPerilCropInsuranceScreen extends StatelessWidget {
  const MultiPerilCropInsuranceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'MPCI Insurance',
      apiPath: '/api/agriculture-enhancement/multi-peril-crop-insurance/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
