import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class VoiceAsrNigerianScreen extends StatelessWidget {
  const VoiceAsrNigerianScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Nigerian Voice ASR Engine',
      apiPath: '/api/channel-banking/voice-asr-nigerian/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
