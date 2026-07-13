import 'package:flutter/material.dart';
import 'package:mobile_app/services/agriculture_service.dart';

class SatelliteCropMonitorScreen extends StatefulWidget {
  const SatelliteCropMonitorScreen({super.key});

  @override
  State<SatelliteCropMonitorScreen> createState() => _SatelliteCropMonitorScreenState();
}

class _SatelliteCropMonitorScreenState extends State<SatelliteCropMonitorScreen> {
  final service = AgricultureService.instance;
  final Color primary = const Color(0xFF0277BD);
  final Color secondary = const Color(0xFFE1F5FE);

  List _records = [];
  Map<String, dynamic> _stats = {};
  bool _loading = true;

  final _farmIdCtrl = TextEditingController();
  final _cropCtrl = TextEditingController();
  final _coordsCtrl = TextEditingController();

  static const _fallbackRecords = [
    {'id': 'SCM-001', 'farm': 'FM-0042', 'crop': 'Rice', 'ndvi_score': '0.72', 'health': 'Healthy', 'last_scan': '2026-05-10', 'alert': 'None'},
    {'id': 'SCM-002', 'farm': 'FM-0089', 'crop': 'Maize', 'ndvi_score': '0.48', 'health': 'Stressed', 'last_scan': '2026-05-10', 'alert': 'Drought Risk'},
    {'id': 'SCM-003', 'farm': 'FM-0113', 'crop': 'Sorghum', 'ndvi_score': '0.65', 'health': 'Moderate', 'last_scan': '2026-05-08', 'alert': 'Pest Alert'},
    {'id': 'SCM-004', 'farm': 'FM-0201', 'crop': 'Wheat', 'ndvi_score': '0.81', 'health': 'Excellent', 'last_scan': '2026-05-09', 'alert': 'None'},
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await service.listSatelliteCropMonitor();
      final statsRes = await service.getSatelliteCropMonitorStats();
      setState(() {
        _records = (res is List && res.isNotEmpty) ? res : _fallbackRecords;
        _stats = statsRes is Map<String, dynamic> ? statsRes : {'scans_this_month': 1248, 'healthy_pct': '62%', 'alerts': 48};
      });
    } catch (_) {
      setState(() {
        _records = _fallbackRecords;
        _stats = {'scans_this_month': 1248, 'healthy_pct': '62%', 'alerts': 48};
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  void _openScanModal() {
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
              const Text('Request Satellite Scan', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              Text('Our Sentinel-2 pipeline will compute NDVI and generate health alerts within 24h', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
              const SizedBox(height: 20),
              _input(_farmIdCtrl, 'Farm ID'),
              _input(_cropCtrl, 'Crop Type'),
              _input(_coordsCtrl, 'GPS Coordinates (lat,lng)'),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: primary, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                  onPressed: () async {
                    Navigator.pop(context);
                    await service.requestSatelliteCropScan({'farm_id': _farmIdCtrl.text, 'crop_type': _cropCtrl.text, 'coordinates': _coordsCtrl.text});
                    _load();
                  },
                  child: const Text('Request Scan'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _input(TextEditingController ctrl, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextField(
        controller: ctrl,
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
            Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
          ],
        ),
      ),
    );
  }

  Color _healthColor(String health) {
    switch (health.toLowerCase()) {
      case 'excellent': return Colors.green.shade700;
      case 'healthy': return Colors.green;
      case 'moderate': return Colors.orange;
      case 'stressed': return Colors.red;
      default: return Colors.blueGrey;
    }
  }

  Widget _ndviBar(String ndviStr) {
    final ndvi = double.tryParse(ndviStr) ?? 0.0;
    final color = ndvi > 0.65 ? Colors.green : ndvi > 0.45 ? Colors.orange : Colors.red;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('NDVI Score', style: TextStyle(color: Colors.grey.shade600, fontSize: 12, fontWeight: FontWeight.w600)),
            Text(ndviStr, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: ndvi,
            backgroundColor: Colors.grey.shade200,
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 8,
          ),
        ),
        const SizedBox(height: 8),
      ],
    );
  }

  @override
  void dispose() {
    _farmIdCtrl.dispose();
    _cropCtrl.dispose();
    _coordsCtrl.dispose();
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
        title: const Text('Satellite Monitor', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.satellite_alt),
        label: const Text('Request Scan'),
        onPressed: _openScanModal,
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: primary))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text('Satellite Crop Monitor', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text('Sentinel-2 NDVI health monitoring for registered farms', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                  const SizedBox(height: 16),
                  Row(children: [
                    _statCard('Scans / Month', _stats['scans_this_month']?.toString() ?? '1,248', Icons.satellite, primary),
                    _statCard('Healthy', _stats['healthy_pct']?.toString() ?? '62%', Icons.eco, Colors.green),
                    _statCard('Alerts', _stats['alerts']?.toString() ?? '48', Icons.warning_amber, Colors.red),
                  ]),
                  const SizedBox(height: 20),
                  ..._records.map((item) {
                    final m = item is Map ? item : {};
                    final health = m['health']?.toString() ?? '-';
                    final alert = m['alert']?.toString() ?? 'None';
                    final ndvi = m['ndvi_score']?.toString() ?? '0';
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
                              Text('${m['crop'] ?? 'Crop'} — ${m['farm'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(color: _healthColor(health).withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                                child: Text(health, style: TextStyle(color: _healthColor(health), fontSize: 11, fontWeight: FontWeight.w600)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          _ndviBar(ndvi),
                          Row(
                            children: [
                              Icon(alert == 'None' ? Icons.check_circle_outline : Icons.warning_amber, size: 14, color: alert == 'None' ? Colors.green : Colors.orange),
                              const SizedBox(width: 4),
                              Text(alert == 'None' ? 'No alerts' : alert, style: TextStyle(color: alert == 'None' ? Colors.green : Colors.orange, fontSize: 12, fontWeight: FontWeight.w500)),
                              const Spacer(),
                              Text('Last scan: ${m['last_scan'] ?? '-'}', style: TextStyle(color: Colors.grey.shade500, fontSize: 11)),
                            ],
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
