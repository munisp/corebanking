import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CooperativeMeetingsScreen extends StatelessWidget {
  const CooperativeMeetingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Coop Meetings',
      apiPath: '/api/agriculture-enhancement/cooperative-meetings/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
