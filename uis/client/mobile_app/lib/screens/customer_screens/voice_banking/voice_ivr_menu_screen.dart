import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class VoiceIvrMenuScreen extends StatelessWidget {
  const VoiceIvrMenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'IVR Menu Engine',
      apiPath: '/api/channel-banking/voice-ivr-menu/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
