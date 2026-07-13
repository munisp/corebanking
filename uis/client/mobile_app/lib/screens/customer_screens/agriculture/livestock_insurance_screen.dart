import 'package:flutter/material.dart';
import 'package:mobile_app/services/agriculture_service.dart';

class LivestockInsuranceScreen extends StatefulWidget {
  const LivestockInsuranceScreen({super.key});

  @override
  State<LivestockInsuranceScreen> createState() => _LivestockInsuranceScreenState();
}

class _LivestockInsuranceScreenState extends State<LivestockInsuranceScreen> {
  final service = AgricultureService.instance;
  final Color primary = const Color(0xFF37474F);
  final Color secondary = const Color(0xFFECEFF1);

  List _records = [];
  Map<String, dynamic> _stats = {};
  bool _loading = true;

  final _farmerCtrl = TextEditingController();
  final _animalCtrl = TextEditingController();
  final _countCtrl = TextEditingController();
  final _sumInsuredCtrl = TextEditingController();

  static const _fallbackRecords = [
    {'id': 'LI-001', 'farmer': 'Musa Garba', 'animal': 'Cattle', 'count': '50', 'insured': '₦3,000,000', 'premium': '₦90,000', 'status': 'Active'},
    {'id': 'LI-002', 'farmer': 'Ibrahim Kano', 'animal': 'Sheep & Goat', 'count': '200', 'insured': '₦1,500,000', 'premium': '₦52,500', 'status': 'Active'},
    {'id': 'LI-003', 'farmer': 'Fatima Danbatta', 'animal': 'Poultry', 'count': '8,000', 'insured': '₦2,400,000', 'premium': '₦84,000', 'status': 'Claim Filed'},
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await service.listLivestockInsurance();
      final statsRes = await service.getLivestockInsuranceStats();
      setState(() {
        _records = (res is List && res.isNotEmpty) ? res : _fallbackRecords;
        _stats = statsRes is Map<String, dynamic> ? statsRes : {'active_policies': 236, 'total_coverage': '₦580M', 'claims_paid': '₦12M'};
      });
    } catch (_) {
      setState(() {
        _records = _fallbackRecords;
        _stats = {'active_policies': 236, 'total_coverage': '₦580M', 'claims_paid': '₦12M'};
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
              const Text('New Insurance Policy', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 20),
              _input(_farmerCtrl, 'Farmer Name'),
              _input(_animalCtrl, 'Animal Type'),
              _input(_countCtrl, 'Animal Count', keyboardType: TextInputType.number),
              _input(_sumInsuredCtrl, 'Sum Insured (₦)', keyboardType: TextInputType.number),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: primary, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                  onPressed: () async {
                    Navigator.pop(context);
                    await service.createLivestockInsurancePolicy({'farmer': _farmerCtrl.text, 'animal_type': _animalCtrl.text, 'count': _countCtrl.text, 'sum_insured': _sumInsuredCtrl.text});
                    _load();
                  },
                  child: const Text('Create Policy'),
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

  Color _statusColor(String s) {
    switch (s.toLowerCase()) {
      case 'active': return Colors.green;
      case 'claim filed': return Colors.orange;
      case 'claim paid': return Colors.blue;
      case 'expired': return Colors.grey;
      default: return Colors.blueGrey;
    }
  }

  @override
  void dispose() {
    _farmerCtrl.dispose();
    _animalCtrl.dispose();
    _countCtrl.dispose();
    _sumInsuredCtrl.dispose();
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
        title: const Text('Livestock Insurance', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.shield),
        label: const Text('New Policy'),
        onPressed: _openCreateModal,
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: primary))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text('Livestock Insurance', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text('Protect farmers from livestock loss due to disease or disaster', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                  const SizedBox(height: 16),
                  Row(children: [
                    _statCard('Policies', _stats['active_policies']?.toString() ?? '236', Icons.policy, primary),
                    _statCard('Coverage', _stats['total_coverage']?.toString() ?? '₦580M', Icons.shield_outlined, Colors.blue),
                    _statCard('Claims Paid', _stats['claims_paid']?.toString() ?? '₦12M', Icons.payment, Colors.orange),
                  ]),
                  const SizedBox(height: 20),
                  ..._records.map((item) {
                    final m = item is Map ? item : {};
                    final status = m['status']?.toString() ?? '-';
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: [BoxShadow(blurRadius: 8, color: Colors.black.withOpacity(0.05), offset: const Offset(0, 3))]),
                      child: ExpansionTile(
                        tilePadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                        childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
                        title: Text(m['farmer'] ?? m['id'] ?? 'Farmer', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(color: _statusColor(status).withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                              child: Text(status, style: TextStyle(color: _statusColor(status), fontSize: 11, fontWeight: FontWeight.w600)),
                            ),
                            const SizedBox(width: 8),
                            Text(m['animal']?.toString() ?? '', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                          ]),
                        ),
                        children: [
                          _row('Animal Type', m['animal']),
                          _row('Count', m['count']),
                          _row('Sum Insured', m['insured']),
                          _row('Premium', m['premium']),
                          _row('Status', m['status']),
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
