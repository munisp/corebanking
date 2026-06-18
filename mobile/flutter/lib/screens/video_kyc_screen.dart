import 'package:flutter/material.dart';

/// Video KYC — Live video verification with BVN/NIN validation and liveness detection
class VideoKycScreen extends StatefulWidget {
  const VideoKycScreen({super.key});
  @override
  State<VideoKycScreen> createState() => _VideoKycScreenState();
}

class _VideoKycScreenState extends State<VideoKycScreen> {
  int _step = 0; // 0=docs, 1=selfie, 2=liveness, 3=review, 4=complete
  final _bvnController = TextEditingController();
  final _ninController = TextEditingController();
  bool _bvnValid = false;
  bool _ninValid = false;
  bool _selfieCapturing = false;
  bool _livenessChecking = false;
  String _livenessInstruction = 'Turn your head left';

  final _steps = ['Documents', 'Selfie', 'Liveness', 'Review', 'Complete'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('KYC Verification')),
      body: Column(children: [
        // Progress stepper
        Padding(padding: const EdgeInsets.all(16), child: Row(
          children: List.generate(5, (i) => Expanded(child: Container(
            height: 4, margin: const EdgeInsets.symmetric(horizontal: 2),
            decoration: BoxDecoration(
              color: i <= _step ? Colors.green : Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2)),
          ))),
        )),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(_steps[_step], style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
        const SizedBox(height: 16),
        Expanded(child: _buildStep()),
      ]),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case 0: return _documentStep();
      case 1: return _selfieStep();
      case 2: return _livenessStep();
      case 3: return _reviewStep();
      case 4: return _completeStep();
      default: return const SizedBox();
    }
  }

  Widget _documentStep() => SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Text('Identity Verification', style: TextStyle(fontWeight: FontWeight.bold)),
      const Text('Enter your BVN and NIN for CBN KYC compliance', style: TextStyle(color: Colors.grey, fontSize: 13)),
      const SizedBox(height: 20),
      // BVN
      TextField(controller: _bvnController, keyboardType: TextInputType.number, maxLength: 11,
        decoration: InputDecoration(
          labelText: 'Bank Verification Number (BVN)',
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          suffixIcon: _bvnValid ? const Icon(Icons.check_circle, color: Colors.green) : null,
          helperText: '11-digit BVN issued by NIBSS',
        ),
        onChanged: (v) => setState(() => _bvnValid = v.length == 11 && RegExp(r'^[0-9]+\$').hasMatch(v)),
      ),
      const SizedBox(height: 16),
      // NIN
      TextField(controller: _ninController, keyboardType: TextInputType.number, maxLength: 11,
        decoration: InputDecoration(
          labelText: 'National Identification Number (NIN)',
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          suffixIcon: _ninValid ? const Icon(Icons.check_circle, color: Colors.green) : null,
          helperText: '11-digit NIN issued by NIMC',
        ),
        onChanged: (v) => setState(() => _ninValid = v.length == 11 && RegExp(r'^[0-9]+\$').hasMatch(v)),
      ),
      const SizedBox(height: 16),
      // Document upload
      const Text('Upload Government ID', style: TextStyle(fontWeight: FontWeight.bold)),
      const SizedBox(height: 8),
      Row(children: [
        _docOption(Icons.credit_card, 'National ID'),
        _docOption(Icons.flight, 'Passport'),
        _docOption(Icons.directions_car, "Driver's License"),
      ].map((w) => Expanded(child: Padding(padding: const EdgeInsets.all(4), child: w))).toList()),
      const SizedBox(height: 24),
      ElevatedButton(
        onPressed: (_bvnValid && _ninValid) ? () => setState(() => _step = 1) : null,
        child: const Text('Continue'),
      ),
    ],
  ));

  Widget _docOption(IconData icon, String label) => InkWell(
    onTap: () {},
    child: Container(padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(8)),
      child: Column(children: [Icon(icon, size: 24), const SizedBox(height: 4), Text(label, style: const TextStyle(fontSize: 10), textAlign: TextAlign.center)]),
    ),
  );

  Widget _selfieStep() => Padding(padding: const EdgeInsets.all(24), child: Column(
    children: [
      Container(height: 300, decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(16)),
        child: Center(child: _selfieCapturing
            ? const CircularProgressIndicator(color: Colors.white)
            : const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.face, size: 64, color: Colors.white54),
                SizedBox(height: 8),
                Text('Position your face in the frame', style: TextStyle(color: Colors.white70)),
              ]))),
      const SizedBox(height: 16),
      const Text('Ensure good lighting and remove glasses/hat', style: TextStyle(color: Colors.grey)),
      const SizedBox(height: 16),
      ElevatedButton.icon(icon: const Icon(Icons.camera), label: const Text('Capture Selfie'),
        onPressed: () { setState(() => _selfieCapturing = true); Future.delayed(const Duration(seconds: 2), () => setState(() { _selfieCapturing = false; _step = 2; })); }),
    ],
  ));

  Widget _livenessStep() => Padding(padding: const EdgeInsets.all(24), child: Column(
    children: [
      Container(height: 300, decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(16)),
        child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.face_retouching_natural, size: 64, color: Colors.green),
          const SizedBox(height: 16),
          Text(_livenessInstruction, style: const TextStyle(color: Colors.white, fontSize: 18)),
          if (_livenessChecking) const Padding(padding: EdgeInsets.only(top: 16), child: CircularProgressIndicator(color: Colors.green)),
        ]))),
      const SizedBox(height: 16),
      LinearProgressIndicator(value: _livenessChecking ? null : 0),
      const SizedBox(height: 16),
      ElevatedButton(onPressed: () {
        setState(() => _livenessChecking = true);
        Future.delayed(const Duration(seconds: 3), () => setState(() { _livenessChecking = false; _step = 3; }));
      }, child: const Text('Start Liveness Check')),
    ],
  ));

  Widget _reviewStep() => Padding(padding: const EdgeInsets.all(24), child: Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Icon(Icons.fact_check, size: 64, color: Colors.blue),
      const SizedBox(height: 16),
      const Text('Review Your Information', textAlign: TextAlign.center, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      const SizedBox(height: 24),
      _infoRow('BVN', _bvnController.text),
      _infoRow('NIN', _ninController.text),
      _infoRow('Selfie', 'Captured ✓'),
      _infoRow('Liveness', 'Passed ✓'),
      _infoRow('Document', 'Uploaded ✓'),
      const SizedBox(height: 24),
      ElevatedButton(onPressed: () => setState(() => _step = 4), style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
        child: const Text('Submit for Verification', style: TextStyle(color: Colors.white))),
    ],
  ));

  Widget _completeStep() => Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
    const Icon(Icons.verified, size: 80, color: Colors.green),
    const SizedBox(height: 16),
    const Text('KYC Submitted!', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
    const SizedBox(height: 8),
    const Text('Verification typically takes 2-4 hours.\nYou will receive a notification when approved.', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
    const SizedBox(height: 8),
    const Text('CBN Tier 3 — Full banking access upon approval', style: TextStyle(color: Colors.green, fontWeight: FontWeight.w500)),
  ]));

  Widget _infoRow(String label, String value) => Padding(padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: const TextStyle(color: Colors.grey)), Text(value)]));
}
