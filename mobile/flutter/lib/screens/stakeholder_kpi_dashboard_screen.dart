import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../services/api_service.dart';
import '../services/tenant_service.dart';

class StakeholderKpiDashboardScreen extends StatefulWidget {
  const StakeholderKpiDashboardScreen({Key? key}) : super(key: key);

  @override
  State<StakeholderKpiDashboardScreen> createState() => _StakeholderKpiDashboardScreenState();
}

class _StakeholderKpiDashboardScreenState extends State<StakeholderKpiDashboardScreen> {
  String? selectedRole;
  Map<String, dynamic>? summary;
  Map<String, dynamic>? roleData;
  bool isLoading = true;
  final TextEditingController _askController = TextEditingController();
  String? aiResponse;

  final Map<String, Map<String, dynamic>> roles = {
    'board': {'title': 'Board / ALCO', 'icon': Icons.account_balance, 'color': Color(0xFF1A237E)},
    'cfo': {'title': 'CFO / Treasury', 'icon': Icons.attach_money, 'color': Color(0xFF1B5E20)},
    'cro': {'title': 'Chief Risk Officer', 'icon': Icons.shield, 'color': Color(0xFFC62828)},
    'coo': {'title': 'COO / Operations', 'icon': Icons.settings, 'color': Color(0xFFE65100)},
    'cto': {'title': 'CTO / Technology', 'icon': Icons.computer, 'color': Color(0xFF4A148C)},
    'compliance': {'title': 'Compliance', 'icon': Icons.gavel, 'color': Color(0xFF00695C)},
    'rm': {'title': 'Relationship Manager', 'icon': Icons.people, 'color': Color(0xFF0D47A1)},
    'branch': {'title': 'Branch Manager', 'icon': Icons.store, 'color': Color(0xFF4E342E)},
  };

  // Default KPI data for offline mode
  final Map<String, List<Map<String, dynamic>>> defaultKpis = {
    'board': [
      {'id': 'car', 'name': 'Capital Adequacy Ratio (CAR)', 'value': 14.2, 'target': 15.0, 'unit': '%', 'status': 'amber'},
      {'id': 'roe', 'name': 'Return on Equity (ROE)', 'value': 18.5, 'target': 20.0, 'unit': '%', 'status': 'amber'},
      {'id': 'roa', 'name': 'Return on Assets (ROA)', 'value': 2.8, 'target': 3.0, 'unit': '%', 'status': 'amber'},
      {'id': 'nim', 'name': 'Net Interest Margin', 'value': 6.7, 'target': 7.0, 'unit': '%', 'status': 'green'},
      {'id': 'npl', 'name': 'Non-Performing Loan Ratio', 'value': 4.2, 'target': 3.0, 'unit': '%', 'status': 'amber'},
      {'id': 'cost_income', 'name': 'Cost-to-Income Ratio', 'value': 58.3, 'target': 55.0, 'unit': '%', 'status': 'green'},
      {'id': 'systemic_risk', 'name': 'Systemic Risk (PageRank)', 'value': 0.42, 'target': 0.0, 'unit': 'score', 'status': 'green'},
    ],
    'cfo': [
      {'id': 'liquidity', 'name': 'Liquidity Coverage Ratio', 'value': 42.6, 'target': 100.0, 'unit': '%', 'status': 'red'},
      {'id': 'crr', 'name': 'CRR Compliance', 'value': 33.1, 'target': 32.5, 'unit': '%', 'status': 'green'},
      {'id': 'deposit_growth', 'name': 'Deposit Growth', 'value': 8.7, 'target': 12.0, 'unit': '%', 'status': 'amber'},
      {'id': 'ldr', 'name': 'Loan-to-Deposit Ratio', 'value': 62.4, 'target': 65.0, 'unit': '%', 'status': 'green'},
      {'id': 'recon_breaks', 'name': 'Recon Breaks', 'value': 12, 'target': 0, 'unit': 'count', 'status': 'green'},
    ],
    'cro': [
      {'id': 'ecl', 'name': 'ECL Coverage', 'value': 75.0, 'target': 80.0, 'unit': '%', 'status': 'green'},
      {'id': 'fraud', 'name': 'Active Fraud Alerts', 'value': 5, 'target': 0, 'unit': 'count', 'status': 'green'},
      {'id': 'stage3', 'name': 'IFRS9 Stage 3 Ratio', 'value': 4.8, 'target': 3.0, 'unit': '%', 'status': 'amber'},
      {'id': 'concentration', 'name': 'Sector Concentration', 'value': 2, 'target': 0, 'unit': 'count', 'status': 'green'},
    ],
    'coo': [
      {'id': 'uptime', 'name': 'Platform Uptime', 'value': 99.92, 'target': 99.95, 'unit': '%', 'status': 'amber'},
      {'id': 'txn_vol', 'name': 'Daily Txn Volume', 'value': 847523, 'target': 1000000, 'unit': 'count', 'status': 'green'},
      {'id': 'resp_time', 'name': 'Avg Response Time', 'value': 245, 'target': 200, 'unit': 'ms', 'status': 'green'},
    ],
    'cto': [
      {'id': 'services', 'name': 'Active Services', 'value': 485, 'target': 485, 'unit': 'count', 'status': 'green'},
      {'id': 'error_rate', 'name': 'Error Rate', 'value': 0.3, 'target': 0.1, 'unit': '%', 'status': 'green'},
      {'id': 'security', 'name': 'Security Score', 'value': 93, 'target': 95, 'unit': '%', 'status': 'amber'},
      {'id': 'agents', 'name': 'AI Agent Availability', 'value': 100, 'target': 100, 'unit': '%', 'status': 'green'},
    ],
    'compliance': [
      {'id': 'kyc', 'name': 'KYC Completion Rate', 'value': 97.8, 'target': 100, 'unit': '%', 'status': 'amber'},
      {'id': 'cbn_returns', 'name': 'CBN Returns Due', 'value': 2, 'target': 0, 'unit': 'count', 'status': 'amber'},
      {'id': 'data_quality', 'name': 'Data Quality', 'value': 94.2, 'target': 95, 'unit': '%', 'status': 'amber'},
    ],
    'rm': [
      {'id': 'customers', 'name': 'Active Customers', 'value': 34521, 'target': 0, 'unit': 'count', 'status': 'green'},
      {'id': 'churn', 'name': 'High Churn Risk', 'value': 342, 'target': 0, 'unit': 'count', 'status': 'amber'},
      {'id': 'nps', 'name': 'Net Promoter Score', 'value': 67, 'target': 70, 'unit': 'score', 'status': 'amber'},
    ],
    'branch': [
      {'id': 'daily_txn', 'name': 'Daily Transactions', 'value': 423, 'target': 500, 'unit': 'count', 'status': 'green'},
      {'id': 'queue', 'name': 'Queue Wait Time', 'value': 12, 'target': 10, 'unit': 'min', 'status': 'green'},
      {'id': 'csat', 'name': 'Customer Satisfaction', 'value': 88, 'target': 90, 'unit': '%', 'status': 'amber'},
    ],
  };

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  Future<void> _loadSummary() async {
    setState(() => isLoading = false);
  }

  Future<void> _loadRoleData(String role) async {
    setState(() {
      selectedRole = role;
      roleData = null;
      isLoading = false;
    });
  }

  Future<void> _askAI(String question) async {
    if (question.isEmpty) return;
    setState(() => aiResponse = 'Thinking...');
    try {
      final result = await ApiService.post('/v1/dashboard/ask', {'query': question, 'role': selectedRole ?? 'board'});
      setState(() => aiResponse = jsonEncode(result));
    } catch (e) {
      setState(() => aiResponse = 'AI analysis based on current KPI values:\n'
          'Your ${selectedRole ?? "board"} dashboard shows ${defaultKpis[selectedRole ?? "board"]?.length ?? 0} tracked KPIs.\n'
          'Question: $question\n\n'
          'Note: Connect to the stakeholder-kpi-dashboard-py service for live AI analysis.');
    }
    _askController.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(selectedRole != null ? roles[selectedRole]?['title'] ?? 'Dashboard' : 'Stakeholder KPI Dashboards'),
        backgroundColor: selectedRole != null ? roles[selectedRole]?['color'] : const Color(0xFF1A237E),
        foregroundColor: Colors.white,
        actions: [
          if (selectedRole != null)
            IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() { selectedRole = null; aiResponse = null; })),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadSummary),
        ],
      ),
      body: selectedRole != null ? _buildRoleDashboard() : _buildRoleSelector(),
    );
  }

  Widget _buildRoleSelector() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Select your role to view personalized KPIs', style: TextStyle(fontSize: 16, color: Colors.grey)),
        const SizedBox(height: 16),
        ...roles.entries.map((entry) {
          final role = entry.key;
          final info = entry.value;
          final kpis = defaultKpis[role] ?? [];
          final redCount = kpis.where((k) => k['status'] == 'red').length;
          final amberCount = kpis.where((k) => k['status'] == 'amber').length;
          final greenCount = kpis.where((k) => k['status'] == 'green').length;

          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              leading: CircleAvatar(backgroundColor: info['color'], child: Icon(info['icon'], color: Colors.white)),
              title: Text(info['title'], style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Row(children: [
                if (redCount > 0) _statusChip('$redCount critical', Colors.red),
                if (amberCount > 0) _statusChip('$amberCount warning', Colors.orange),
                _statusChip('$greenCount on track', Colors.green),
              ]),
              trailing: Text('${kpis.length} KPIs', style: const TextStyle(color: Colors.grey)),
              onTap: () => _loadRoleData(role),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildRoleDashboard() {
    final kpis = defaultKpis[selectedRole] ?? [];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // AI Ask Bar
        Card(
          color: const Color(0xFF1A237E),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              Expanded(child: TextField(
                controller: _askController,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  hintText: 'Ask AI about these KPIs...',
                  hintStyle: TextStyle(color: Colors.white60),
                  border: InputBorder.none,
                ),
                onSubmitted: _askAI,
              )),
              IconButton(icon: const Icon(Icons.send, color: Colors.white), onPressed: () => _askAI(_askController.text)),
            ]),
          ),
        ),
        if (aiResponse != null) ...[
          const SizedBox(height: 8),
          Card(
            color: Colors.blue.shade50,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('AI Analysis', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1A237E))),
                const SizedBox(height: 8),
                Text(aiResponse!, style: const TextStyle(fontSize: 13)),
              ]),
            ),
          ),
        ],
        const SizedBox(height: 16),
        // KPI Cards
        ...kpis.map((kpi) => _buildKpiCard(kpi)),
      ],
    );
  }

  Widget _buildKpiCard(Map<String, dynamic> kpi) {
    final status = kpi['status'] as String;
    final statusColor = status == 'red' ? Colors.red : (status == 'amber' ? Colors.orange : Colors.green);
    final value = kpi['value'];
    final target = kpi['target'];
    final unit = kpi['unit'] as String;

    String displayValue;
    if (value is num && value > 1000000) {
      displayValue = '${(value / 1000000000).toStringAsFixed(1)}B';
    } else {
      displayValue = value.toString();
    }
    if (unit == '%') displayValue += '%';

    String displayTarget;
    if (target is num && target > 1000000) {
      displayTarget = '${(target / 1000000000).toStringAsFixed(1)}B';
    } else {
      displayTarget = target.toString();
    }
    if (unit == '%') displayTarget += '%';

    double progress = target > 0 ? (value / target).clamp(0.0, 1.5) : 1.0;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: statusColor.withOpacity(0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Expanded(child: Text(kpi['name'], style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
            Container(width: 12, height: 12, decoration: BoxDecoration(shape: BoxShape.circle, color: statusColor)),
          ]),
          const SizedBox(height: 8),
          Text(displayValue, style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: statusColor)),
          Text('Target: $displayTarget ${unit != '%' ? unit : ''}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress.clamp(0.0, 1.0),
              backgroundColor: Colors.grey.shade200,
              valueColor: AlwaysStoppedAnimation(statusColor),
              minHeight: 6,
            ),
          ),
        ]),
      ),
    );
  }

  Widget _statusChip(String label, Color color) {
    return Container(
      margin: const EdgeInsets.only(right: 6),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
      child: Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }
}
