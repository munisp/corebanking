import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class VoiceBiometricAuthScreen extends StatelessWidget {
  const VoiceBiometricAuthScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Voice Biometric Auth',
      apiPath: '/api/channel-banking/voice-biometric-auth/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
