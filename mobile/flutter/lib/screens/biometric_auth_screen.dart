import 'package:flutter/material.dart';

class BiometricAuthScreen extends StatefulWidget {
  const BiometricAuthScreen({super.key});
  @override
  State<BiometricAuthScreen> createState() => _BiometricAuthScreenState();
}

class _BiometricAuthScreenState extends State<BiometricAuthScreen> {
  bool _fingerprintEnabled = true;
  bool _faceIdEnabled = false;
  bool _voiceEnabled = false;
  bool _loginBiometric = true;
  bool _transferBiometric = true;
  bool _viewBalanceBiometric = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Biometric Authentication')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
            const Icon(Icons.fingerprint, size: 64, color: Colors.blue),
            const SizedBox(height: 8),
            const Text('Biometric Security', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            const Text('Use biometrics for faster, more secure access', style: TextStyle(color: Colors.grey)),
          ]))),
          const SizedBox(height: 24),
          const Text('Enrolled Biometrics', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SwitchListTile(title: const Text('Fingerprint'), subtitle: const Text('2 fingers enrolled'),
            secondary: const Icon(Icons.fingerprint), value: _fingerprintEnabled,
            onChanged: (v) => setState(() => _fingerprintEnabled = v)),
          SwitchListTile(title: const Text('Face ID'), subtitle: const Text('Not enrolled'),
            secondary: const Icon(Icons.face), value: _faceIdEnabled,
            onChanged: (v) => setState(() => _faceIdEnabled = v)),
          SwitchListTile(title: const Text('Voice Recognition'), subtitle: const Text('Beta — not enrolled'),
            secondary: const Icon(Icons.mic), value: _voiceEnabled,
            onChanged: (v) => setState(() => _voiceEnabled = v)),
          const Divider(),
          const SizedBox(height: 8),
          const Text('Use Biometric For', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          CheckboxListTile(title: const Text('App Login'), value: _loginBiometric,
            onChanged: (v) => setState(() => _loginBiometric = v!)),
          CheckboxListTile(title: const Text('Transfer Authorization'), value: _transferBiometric,
            onChanged: (v) => setState(() => _transferBiometric = v!)),
          CheckboxListTile(title: const Text('View Balance'), value: _viewBalanceBiometric,
            onChanged: (v) => setState(() => _viewBalanceBiometric = v!)),
          const SizedBox(height: 16),
          Card(color: Colors.orange.shade50, child: const Padding(
            padding: EdgeInsets.all(12),
            child: Row(children: [
              Icon(Icons.info_outline, color: Colors.orange),
              SizedBox(width: 8),
              Expanded(child: Text('PIN/Password remains available as fallback for all operations', style: TextStyle(fontSize: 12))),
            ]),
          )),
        ]),
      ),
    );
  }
}
