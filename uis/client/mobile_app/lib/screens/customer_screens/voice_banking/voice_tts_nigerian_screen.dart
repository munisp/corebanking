import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class VoiceTtsNigerianScreen extends StatelessWidget {
  const VoiceTtsNigerianScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Nigerian Voice TTS Engine',
      apiPath: '/api/channel-banking/voice-tts-nigerian/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
