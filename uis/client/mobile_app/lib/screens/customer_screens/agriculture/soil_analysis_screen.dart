import 'package:flutter/material.dart';
import 'package:mobile_app/services/agriculture_service.dart';

class SoilAnalysisScreen extends StatefulWidget {
  const SoilAnalysisScreen({super.key});

  @override
  State<SoilAnalysisScreen> createState() => _SoilAnalysisScreenState();
}

class _SoilAnalysisScreenState extends State<SoilAnalysisScreen> {
  final service = AgricultureService.instance;
  final Color primary = const Color(0xFF5D4037);
  final Color secondary = const Color(0xFFEFEBE9);

  List _records = [];
  Map<String, dynamic> _stats = {};
  bool _loading = true;

  final _farmIdCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();
  final _depthCtrl = TextEditingController();

  static const _fallbackRecords = [
    {'id': 'SA-001', 'farm': 'FM-0042', 'state': 'Kano', 'nitrogen': '42 mg/kg', 'phosphorus': '18 mg/kg', 'potassium': '210 mg/kg', 'ph': '6.8', 'fertility': 'High', 'status': 'Complete'},
    {'id': 'SA-002', 'farm': 'FM-0089', 'state': 'Benue', 'nitrogen': '28 mg/kg', 'phosphorus': '12 mg/kg', 'potassium': '140 mg/kg', 'ph': '5.9', 'fertility': 'Medium', 'status': 'Complete'},
    {'id': 'SA-003', 'farm': 'FM-0113', 'state': 'Niger', 'nitrogen': '15 mg/kg', 'phosphorus': '6 mg/kg', 'potassium': '90 mg/kg', 'ph': '5.2', 'fertility': 'Low', 'status': 'Complete'},
    {'id': 'SA-004', 'farm': 'FM-0201', 'state': 'Kaduna', 'nitrogen': '-', 'phosphorus': '-', 'potassium': '-', 'ph': '-', 'fertility': '-', 'status': 'Pending'},
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await service.listSoilAnalysis();
      final statsRes = await service.getSoilAnalysisStats();
      setState(() {
        _records = (res is List && res.isNotEmpty) ? res : _fallbackRecords;
        _stats = statsRes is Map<String, dynamic> ? statsRes : {'samples_analyzed': 3420, 'avg_ph': '6.4', 'high_fertility_pct': '38%'};
      });
    } catch (_) {
      setState(() {
        _records = _fallbackRecords;
        _stats = {'samples_analyzed': 3420, 'avg_ph': '6.4', 'high_fertility_pct': '38%'};
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  void _openSubmitModal() {
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
              const Text('Submit Soil Sample', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              Text('Results include NPK levels, pH, and fertility rating with fertilizer recommendations', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
              const SizedBox(height: 20),
              _input(_farmIdCtrl, 'Farm ID'),
              _input(_stateCtrl, 'State'),
              _input(_depthCtrl, 'Sample Depth (cm)', keyboardType: TextInputType.number),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: primary, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                  onPressed: () async {
                    Navigator.pop(context);
                    await service.submitSoilSample({'farm_id': _farmIdCtrl.text, 'state': _stateCtrl.text, 'sample_depth_cm': _depthCtrl.text});
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
            Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
          ],
        ),
      ),
    );
  }

  Color _fertilityColor(String f) {
    switch (f.toLowerCase()) {
      case 'high': return Colors.green;
      case 'medium': return Colors.orange;
      case 'low': return Colors.red;
      default: return Colors.blueGrey;
    }
  }

  Widget _npkCell(String label, String value) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 3),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(10)),
        child: Column(
          children: [
            Text(label, style: TextStyle(fontSize: 10, color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _farmIdCtrl.dispose();
    _stateCtrl.dispose();
    _depthCtrl.dispose();
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
        title: const Text('Soil Analysis', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.science),
        label: const Text('Submit Sample'),
        onPressed: _openSubmitModal,
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: primary))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text('Soil Analysis', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text('NPK levels, pH testing, and fertility ratings for farm soils', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                  const SizedBox(height: 16),
                  Row(children: [
                    _statCard('Samples', _stats['samples_analyzed']?.toString() ?? '3,420', Icons.biotech, primary),
                    _statCard('Avg pH', _stats['avg_ph']?.toString() ?? '6.4', Icons.water_drop, Colors.blue),
                    _statCard('High Fertility', _stats['high_fertility_pct']?.toString() ?? '38%', Icons.spa, Colors.green),
                  ]),
                  const SizedBox(height: 20),
                  ..._records.map((item) {
                    final m = item is Map ? item : {};
                    final fertility = m['fertility']?.toString() ?? '-';
                    final isPending = m['status']?.toString().toLowerCase() == 'pending';
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: [BoxShadow(blurRadius: 8, color: Colors.black.withOpacity(0.05), offset: const Offset(0, 3))]),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('${m['farm'] ?? m['id'] ?? 'Farm'} — ${m['state'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                              if (!isPending)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(color: _fertilityColor(fertility).withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                                  child: Text('$fertility Fertility', style: TextStyle(color: _fertilityColor(fertility), fontSize: 11, fontWeight: FontWeight.w600)),
                                )
                              else
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(color: Colors.orange.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
                                  child: const Text('Pending', style: TextStyle(color: Colors.orange, fontSize: 11, fontWeight: FontWeight.w600)),
                                ),
                            ],
                          ),
                          if (!isPending) ...[
                            const SizedBox(height: 12),
                            Row(children: [
                              _npkCell('Nitrogen', m['nitrogen']?.toString() ?? '-'),
                              _npkCell('Phosphorus', m['phosphorus']?.toString() ?? '-'),
                              _npkCell('Potassium', m['potassium']?.toString() ?? '-'),
                              _npkCell('pH', m['ph']?.toString() ?? '-'),
                            ]),
                          ] else
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text('Analysis in progress', style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
                            ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
    );
  }
}
