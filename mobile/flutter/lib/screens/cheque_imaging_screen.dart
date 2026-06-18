import 'package:flutter/material.dart';

class ChequeImagingScreen extends StatefulWidget {
  const ChequeImagingScreen({super.key});
  @override
  State<ChequeImagingScreen> createState() => _ChequeImagingScreenState();
}

class _ChequeImagingScreenState extends State<ChequeImagingScreen> {
  final List<Map<String, dynamic>> _images = [
    {'chequeNo': 'CHQ-00456789', 'capturedAt': '2024-01-15 09:30', 'quality': 'Good', 'ocrStatus': 'Verified', 'amount': 2500000, 'micr': 'Valid'},
    {'chequeNo': 'CHQ-00456790', 'capturedAt': '2024-01-14 11:15', 'quality': 'Good', 'ocrStatus': 'Verified', 'amount': 850000, 'micr': 'Valid'},
    {'chequeNo': 'CHQ-00456791', 'capturedAt': '2024-01-13 14:45', 'quality': 'Poor', 'ocrStatus': 'Manual Review', 'amount': 15000000, 'micr': 'Misread'},
    {'chequeNo': 'CHQ-00456792', 'capturedAt': '2024-01-15 10:00', 'quality': 'Good', 'ocrStatus': 'Verified', 'amount': 450000, 'micr': 'Valid'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cheque Imaging'), actions: [
        IconButton(icon: const Icon(Icons.camera_alt), onPressed: () {}, tooltip: 'Capture Cheque'),
      ]),
      body: Column(children: [
        Container(padding: const EdgeInsets.all(12), color: Colors.blue[50], child: Row(children: [
          Expanded(child: _stat('Captured Today', '${_images.length}', Colors.blue)),
          Expanded(child: _stat('OCR Verified', '${_images.where((i) => i["ocrStatus"] == "Verified").length}', Colors.green)),
          Expanded(child: _stat('Manual Review', '${_images.where((i) => i["ocrStatus"] == "Manual Review").length}', Colors.orange)),
        ])),
        Expanded(child: ListView.builder(itemCount: _images.length, itemBuilder: (ctx, i) {
          final img = _images[i];
          final qualityColor = img['quality'] == 'Good' ? Colors.green : Colors.orange;
          return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ExpansionTile(
            leading: Icon(Icons.image, color: qualityColor),
            title: Text(img['chequeNo'] as String), subtitle: Text('Captured: ${img["capturedAt"]}'),
            children: [Padding(padding: const EdgeInsets.all(16), child: Column(children: [
              _detailRow('Amount', '₦${((img["amount"] as int) / 100).toStringAsFixed(0)}'),
              _detailRow('Image Quality', img['quality'] as String),
              _detailRow('OCR Status', img['ocrStatus'] as String),
              _detailRow('MICR Line', img['micr'] as String),
              const SizedBox(height: 8),
              Container(height: 100, width: double.infinity, decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(8)),
                child: const Center(child: Icon(Icons.image, size: 48, color: Colors.grey))),
            ]))],
          ));
        })),
      ]),
    );
  }

  Widget _stat(String label, String value, Color color) {
    return Column(children: [Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)), Text(label, style: const TextStyle(fontSize: 11))]);
  }

  Widget _detailRow(String label, String value) {
    return Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(color: Colors.grey)), Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
    ]));
  }
}
