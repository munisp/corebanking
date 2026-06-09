import 'package:flutter/material.dart';

/// KPI Dashboard with real-time banking metrics, charts, and drill-down
class KpiDashboardScreen extends StatefulWidget {
  const KpiDashboardScreen({super.key});
  @override
  State<KpiDashboardScreen> createState() => _KpiDashboardScreenState();
}

class _KpiDashboardScreenState extends State<KpiDashboardScreen> {
  String _timeRange = '7d';
  bool _isLoading = true;
  Map<String, dynamic> _kpiData = {};

  @override
  void initState() {
    super.initState();
    _loadKPIData();
  }

  Future<void> _loadKPIData() async {
    setState(() => _isLoading = true);
    await Future.delayed(const Duration(seconds: 1));
    setState(() {
      _isLoading = false;
      _kpiData = {
        'total_accounts': 124500,
        'active_accounts': 89200,
        'total_transactions_today': 45230,
        'transaction_volume_kobo': 8_500_000_000_00, // ₦85B
        'npl_ratio': 3.2,
        'car_ratio': 18.5,
        'liquidity_ratio': 42.3,
        'digital_adoption': 78.5,
        'uptime_pct': 99.97,
        'avg_response_ms': 142,
        'fraud_blocked_today': 23,
        'new_accounts_today': 312,
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Performance Dashboard'),
        actions: [
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: '1d', label: Text('1D')),
              ButtonSegment(value: '7d', label: Text('7D')),
              ButtonSegment(value: '30d', label: Text('30D')),
            ],
            selected: {_timeRange},
            onSelectionChanged: (v) { setState(() => _timeRange = v.first); _loadKPIData(); },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadKPIData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildOverviewCards(),
                  const SizedBox(height: 16),
                  _buildRegulatorySection(),
                  const SizedBox(height: 16),
                  _buildOperationalSection(),
                  const SizedBox(height: 16),
                  _buildDigitalSection(),
                ],
              ),
            ),
    );
  }

  Widget _buildOverviewCards() {
    return GridView.count(
      crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 1.5,
      children: [
        _kpiCard('Total Accounts', _formatNumber(_kpiData['total_accounts'] ?? 0), Icons.people, Colors.blue, '+${_kpiData['new_accounts_today']} today'),
        _kpiCard('Transactions Today', _formatNumber(_kpiData['total_transactions_today'] ?? 0), Icons.swap_horiz, Colors.green, null),
        _kpiCard('Volume Today', '\u20A6${_formatKobo(_kpiData['transaction_volume_kobo'] ?? 0)}', Icons.trending_up, Colors.purple, null),
        _kpiCard('Fraud Blocked', '${_kpiData['fraud_blocked_today'] ?? 0}', Icons.shield, Colors.orange, 'today'),
      ],
    );
  }

  Widget _buildRegulatorySection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('CBN Regulatory Ratios', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 12),
            _ratioBar('NPL Ratio', _kpiData['npl_ratio'] ?? 0, 5.0, suffix: '%', warning: 5.0),
            _ratioBar('Capital Adequacy (CAR)', _kpiData['car_ratio'] ?? 0, 30.0, suffix: '%', min: 10.0),
            _ratioBar('Liquidity Ratio', _kpiData['liquidity_ratio'] ?? 0, 100.0, suffix: '%', min: 30.0),
          ],
        ),
      ),
    );
  }

  Widget _buildOperationalSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('System Health', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 12),
            _metricTile('Uptime', '${_kpiData['uptime_pct']}%', Icons.cloud_done, Colors.green),
            _metricTile('Avg Response', '${_kpiData['avg_response_ms']}ms', Icons.speed, Colors.blue),
            _metricTile('Active Sessions', '${_kpiData['active_accounts']}', Icons.devices, Colors.purple),
          ],
        ),
      ),
    );
  }

  Widget _buildDigitalSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Digital Banking', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 12),
            _ratioBar('Digital Adoption', _kpiData['digital_adoption'] ?? 0, 100.0, suffix: '%'),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _channelStat('Mobile', '45%'),
                _channelStat('USSD', '23%'),
                _channelStat('Web', '18%'),
                _channelStat('POS', '14%'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _kpiCard(String title, String value, IconData icon, Color color, String? subtitle) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(children: [Icon(icon, color: color, size: 20), const SizedBox(width: 8), Expanded(child: Text(title, style: const TextStyle(fontSize: 11, color: Colors.grey)))]),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            if (subtitle != null) Text(subtitle, style: TextStyle(fontSize: 10, color: Colors.grey.shade600)),
          ],
        ),
      ),
    );
  }

  Widget _ratioBar(String label, double value, double max, {String suffix = '', double? warning, double? min}) {
    final ratio = (value / max).clamp(0.0, 1.0);
    Color barColor = Colors.green;
    if (warning != null && value >= warning) barColor = Colors.red;
    if (min != null && value < min) barColor = Colors.red;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: const TextStyle(fontSize: 13)), Text('$value$suffix', style: TextStyle(fontWeight: FontWeight.bold, color: barColor))]),
          const SizedBox(height: 4),
          LinearProgressIndicator(value: ratio, backgroundColor: Colors.grey.shade200, color: barColor, minHeight: 6),
        ],
      ),
    );
  }

  Widget _metricTile(String label, String value, IconData icon, Color color) {
    return ListTile(
      dense: true, contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: color),
      title: Text(label),
      trailing: Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
    );
  }

  Widget _channelStat(String label, String value) {
    return Column(children: [Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)), Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey))]);
  }

  String _formatNumber(int n) => n.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  String _formatKobo(int kobo) {
    final b = kobo ~/ 100_000_000_00;
    if (b > 0) return '${b}B';
    final m = kobo ~/ 100_000_00;
    if (m > 0) return '${m}M';
    return '${kobo ~/ 100}';
  }
}
