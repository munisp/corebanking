import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class VoiceAgentEscalationScreen extends StatelessWidget {
  const VoiceAgentEscalationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Voice Agent Escalation',
      apiPath: '/api/channel-banking/voice-agent-escalation/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
