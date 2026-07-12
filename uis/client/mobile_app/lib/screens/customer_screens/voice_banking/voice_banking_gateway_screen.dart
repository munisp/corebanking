import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class VoiceBankingGatewayScreen extends StatelessWidget {
  const VoiceBankingGatewayScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Voice Banking Gateway',
      apiPath: '/api/channel-banking/voice-banking-gateway/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
