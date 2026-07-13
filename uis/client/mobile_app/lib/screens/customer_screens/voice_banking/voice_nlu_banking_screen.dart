import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class VoiceNluBankingScreen extends StatelessWidget {
  const VoiceNluBankingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Voice NLU Banking Intent',
      apiPath: '/api/channel-banking/voice-nlu-banking/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
