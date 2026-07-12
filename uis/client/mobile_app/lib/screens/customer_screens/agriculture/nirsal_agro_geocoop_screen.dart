import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class NirsalAgroGeocoopScreen extends StatelessWidget {
  const NirsalAgroGeocoopScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'NIRSAL Geo-Coop',
      apiPath: '/api/agriculture-enhancement/nirsal-agro-geocoop/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
