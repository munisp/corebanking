import 'package:flutter/material.dart';
import 'package:mobile_app/services/agriculture_service.dart';

class CropYieldPredictionScreen extends StatefulWidget {
  const CropYieldPredictionScreen({super.key});

  @override
  State<CropYieldPredictionScreen> createState() => _CropYieldPredictionScreenState();
}

class _CropYieldPredictionScreenState extends State<CropYieldPredictionScreen> {
  final service = AgricultureService.instance;
  final Color primary = const Color(0xFF6A1B9A);
  final Color secondary = const Color(0xFFF3E5F5);

  List _records = [];
  Map<String, dynamic> _stats = {};
  bool _loading = true;

  final _farmIdCtrl = TextEditingController();
  final _cropCtrl = TextEditingController();
  final _seasonCtrl = TextEditingController();
  final _areaHaCtrl = TextEditingController();

  static const _fallbackRecords = [
    {'id': 'CYP-001', 'farm': 'FM-0042', 'crop': 'Rice', 'season': '2026 Wet', 'predicted_yield': '4.2 t/ha', 'confidence': '87%', 'model': 'ML-v3', 'status': 'Confirmed'},
    {'id': 'CYP-002', 'farm': 'FM-0089', 'crop': 'Maize', 'season': '2026 Dry', 'predicted_yield': '3.8 t/ha', 'confidence': '79%', 'model': 'ML-v3', 'status': 'Pending'},
    {'id': 'CYP-003', 'farm': 'FM-0113', 'crop': 'Sorghum', 'season': '2026 Wet', 'predicted_yield': '2.5 t/ha', 'confidence': '91%', 'model': 'ML-v3', 'status': 'Confirmed'},
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await service.listCropYieldPredictions();
      final statsRes = await service.getCropYieldPredictionStats();
      setState(() {
        _records = (res is List && res.isNotEmpty) ? res : _fallbackRecords;
        _stats = statsRes is Map<String, dynamic> ? statsRes : {'total_predictions': 342, 'avg_confidence': '84%', 'avg_yield': '3.6 t/ha'};
      });
    } catch (_) {
      setState(() {
        _records = _fallbackRecords;
        _stats = {'total_predictions': 342, 'avg_confidence': '84%', 'avg_yield': '3.6 t/ha'};
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  void _openCreateModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(30))),
      builder: (_) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 24, bottom: MediaQuery.of(context).viewInsets.bottom + 24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Request Prediction', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              Text('Our ML model will predict yield based on satellite + weather data', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
              const SizedBox(height: 20),
              _input(_farmIdCtrl, 'Farm ID'),
              _input(_cropCtrl, 'Crop Type'),
              _input(_seasonCtrl, 'Season (e.g. 2026 Wet)'),
              _input(_areaHaCtrl, 'Area (ha)', keyboardType: TextInputType.number),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: primary, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                  onPressed: () async {
                    Navigator.pop(context);
                    await service.createCropYieldPrediction({'farm_id': _farmIdCtrl.text, 'crop_type': _cropCtrl.text, 'season': _seasonCtrl.text, 'area_ha': _areaHaCtrl.text});
                    _load();
                  },
                  child: const Text('Submit'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _input(TextEditingController ctrl, String label, {TextInputType? keyboardType}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextField(
        controller: ctrl,
        keyboardType: keyboardType,
        decoration: InputDecoration(labelText: label, filled: true, fillColor: Colors.grey.shade100, border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none)),
      ),
    );
  }

  Widget _statCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(16)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 8),
            Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
          ],
        ),
      ),
    );
  }

  Color _confidenceColor(String conf) {
    final val = int.tryParse(conf.replaceAll('%', '')) ?? 0;
    if (val >= 85) return Colors.green;
    if (val >= 70) return Colors.orange;
    return Colors.red;
  }

  Color _statusColor(String s) {
    if (s.toLowerCase() == 'confirmed') return Colors.green;
    if (s.toLowerCase() == 'pending') return Colors.orange;
    return Colors.blueGrey;
  }

  @override
  void dispose() {
    _farmIdCtrl.dispose();
    _cropCtrl.dispose();
    _seasonCtrl.dispose();
    _areaHaCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: primary,
        foregroundColor: Colors.white,
        title: const Text('Yield Prediction', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.auto_graph),
        label: const Text('Request'),
        onPressed: _openCreateModal,
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: primary))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text('Crop Yield Prediction', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text('AI-powered yield forecasts using satellite & weather data', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                  const SizedBox(height: 16),
                  Row(children: [
                    _statCard('Predictions', _stats['total_predictions']?.toString() ?? '342', Icons.analytics, primary),
                    _statCard('Avg Confidence', _stats['avg_confidence']?.toString() ?? '84%', Icons.verified, Colors.teal),
                    _statCard('Avg Yield', _stats['avg_yield']?.toString() ?? '3.6 t/ha', Icons.grass, Colors.orange),
                  ]),
                  const SizedBox(height: 20),
                  ..._records.map((item) {
                    final m = item is Map ? item : {};
                    final conf = m['confidence']?.toString() ?? '0%';
                    final status = m['status']?.toString() ?? '-';
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: [BoxShadow(blurRadius: 8, color: Colors.black.withOpacity(0.05), offset: const Offset(0, 3))]),
                      child: ExpansionTile(
                        tilePadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                        childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
                        title: Text('${m['crop'] ?? 'Crop'} — ${m['farm'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Row(children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(color: _confidenceColor(conf).withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                              child: Text('Confidence: $conf', style: TextStyle(color: _confidenceColor(conf), fontSize: 11, fontWeight: FontWeight.w600)),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(color: _statusColor(status).withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
                              child: Text(status, style: TextStyle(color: _statusColor(status), fontSize: 11, fontWeight: FontWeight.w600)),
                            ),
                          ]),
                        ),
                        children: [
                          _row('Farm ID', m['farm']),
                          _row('Crop', m['crop']),
                          _row('Season', m['season']),
                          _row('Predicted Yield', m['predicted_yield']),
                          _row('Confidence', m['confidence']),
                          _row('Model', m['model']),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
    );
  }

  Widget _row(String label, dynamic value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(children: [
        Expanded(flex: 2, child: Text(label, style: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.w600, fontSize: 13))),
        Expanded(flex: 3, child: Text(value?.toString() ?? '-', style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13))),
      ]),
    );
  }
}
