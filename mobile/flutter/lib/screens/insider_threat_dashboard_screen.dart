import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

/// 54Bank Insider Threat Dashboard — Flutter
/// Security Operations Center for mobile security officers.
/// Integrates with PAM, UEBA, DLP, Canary Tokens, Break-Glass,
/// Session Recording, Velocity Limits, Self-Dealing, GL Reconciliation,
/// Credential Rotation, Code Signing, and Dormant Account Monitor.

class InsiderThreatDashboardScreen extends StatefulWidget {
  const InsiderThreatDashboardScreen({Key? key}) : super(key: key);

  @override
  State<InsiderThreatDashboardScreen> createState() => _InsiderThreatDashboardScreenState();
}

class _InsiderThreatDashboardScreenState extends State<InsiderThreatDashboardScreen> {
  int _pamActiveSessions = 0;
  int _uebaAlerts = 0;
  int _dlpBlocked = 0;
  int _canaryTriggers = 0;
  int _breakGlassActive = 0;
  int _velocityBlocked = 0;
  int _selfDealingAlerts = 0;
  int _glReconAlerts = 0;
  int _staleCredentials = 0;
  int _dormantAlerts = 0;
  bool _isLoading = true;
  String _selectedTab = 'overview';

  List<Map<String, dynamic>> _pamRequests = [];
  List<Map<String, dynamic>> _uebaAlertList = [];
  List<Map<String, dynamic>> _canaryTokens = [];
  List<Map<String, dynamic>> _dlpEvents = [];

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    setState(() => _isLoading = true);
    // In production, these would call actual service endpoints
    // Simulated data for UI demonstration
    await Future.delayed(const Duration(milliseconds: 500));
    setState(() {
      _pamActiveSessions = 2;
      _uebaAlerts = 5;
      _dlpBlocked = 3;
      _canaryTriggers = 1;
      _breakGlassActive = 0;
      _velocityBlocked = 7;
      _selfDealingAlerts = 2;
      _glReconAlerts = 0;
      _staleCredentials = 4;
      _dormantAlerts = 1;
      _isLoading = false;

      _pamRequests = [
        {'id': 'PAM-001', 'requestor': 'john.doe', 'resource': 'database:core_banking', 'status': 'pending', 'duration': '60 min'},
        {'id': 'PAM-002', 'requestor': 'jane.smith', 'resource': 'service:gl-engine', 'status': 'active', 'duration': '120 min'},
      ];
      _uebaAlertList = [
        {'id': 'UEBA-001', 'employee': 'emp-042', 'type': 'login_time', 'severity': 'high', 'details': 'Login at 03:15 AM'},
        {'id': 'UEBA-002', 'employee': 'emp-108', 'type': 'txn_spike', 'severity': 'critical', 'details': '4.2x normal volume'},
        {'id': 'UEBA-003', 'employee': 'emp-015', 'type': 'new_device', 'severity': 'medium', 'details': 'Unknown device'},
      ];
      _canaryTokens = [
        {'id': 'CANARY-ACCT-001', 'type': 'account', 'name': 'Test Account', 'status': 'active', 'triggers': 0},
        {'id': 'CANARY-KEY-001', 'type': 'api_key', 'name': 'Legacy API Key', 'status': 'triggered', 'triggers': 1},
      ];
      _dlpEvents = [
        {'id': 'DLP-001', 'actor': 'emp-077', 'rule': 'Bulk Query Detection', 'action': 'block', 'records': 15000},
        {'id': 'DLP-002', 'actor': 'emp-033', 'rule': 'PII Bulk Access', 'action': 'block', 'records': 500},
      ];
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Insider Threat Dashboard'),
        backgroundColor: const Color(0xFF1A1A2E),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadDashboardData,
          ),
          IconButton(
            icon: const Icon(Icons.notifications_active),
            onPressed: () => _showAlertDialog(),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadDashboardData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildSummaryCards(),
                    _buildTabBar(),
                    _buildTabContent(),
                  ],
                ),
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showBreakGlassDialog(),
        backgroundColor: Colors.red,
        icon: const Icon(Icons.warning_amber),
        label: const Text('Break Glass'),
      ),
    );
  }

  Widget _buildSummaryCards() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Security Overview', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1.8,
            children: [
              _buildMetricCard('PAM Sessions', _pamActiveSessions, Colors.orange, Icons.lock_open),
              _buildMetricCard('UEBA Anomalies', _uebaAlerts, Colors.amber, Icons.psychology),
              _buildMetricCard('DLP Blocks', _dlpBlocked, Colors.red, Icons.shield),
              _buildMetricCard('Canary Triggers', _canaryTriggers, Colors.deepPurple, Icons.pest_control),
              _buildMetricCard('Velocity Blocks', _velocityBlocked, Colors.blue, Icons.speed),
              _buildMetricCard('Self-Dealing', _selfDealingAlerts, Colors.teal, Icons.people),
              _buildMetricCard('GL Alerts', _glReconAlerts, Colors.green, Icons.account_balance),
              _buildMetricCard('Stale Creds', _staleCredentials, Colors.brown, Icons.key),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard(String label, int value, Color color, IconData icon) {
    return Card(
      elevation: 2,
      color: color.withOpacity(0.1),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: color, size: 20),
                const SizedBox(width: 8),
                Text('$value', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color)),
              ],
            ),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(fontSize: 12, color: color.withOpacity(0.8)), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  Widget _buildTabBar() {
    final tabs = ['overview', 'pam', 'ueba', 'dlp', 'canary'];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: tabs.map((tab) {
          final isSelected = _selectedTab == tab;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(tab.toUpperCase()),
              selected: isSelected,
              selectedColor: const Color(0xFF1A1A2E),
              labelStyle: TextStyle(color: isSelected ? Colors.white : Colors.black87, fontWeight: FontWeight.w600),
              onSelected: (_) => setState(() => _selectedTab = tab),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTabContent() {
    switch (_selectedTab) {
      case 'pam':
        return _buildPAMSection();
      case 'ueba':
        return _buildUEBASection();
      case 'dlp':
        return _buildDLPSection();
      case 'canary':
        return _buildCanarySection();
      default:
        return _buildOverviewSection();
    }
  }

  Widget _buildOverviewSection() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Recent Alerts', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ..._uebaAlertList.map((alert) => _buildAlertTile(alert)),
          const SizedBox(height: 16),
          const Text('Active PAM Requests', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ..._pamRequests.map((req) => _buildPAMTile(req)),
        ],
      ),
    );
  }

  Widget _buildPAMSection() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('PAM Requests', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ElevatedButton.icon(
                onPressed: () => _showPAMRequestDialog(),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Request Access'),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1A1A2E)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ..._pamRequests.map((req) => _buildPAMTile(req)),
          const SizedBox(height: 24),
          const Text('Access Policies', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          _buildPolicyTile('database:core_banking', '60 min', '2 approvers', true),
          _buildPolicyTile('service:gl-engine', '120 min', '1 approver', true),
          _buildPolicyTile('vault:secrets', '30 min', '2 approvers', true),
          _buildPolicyTile('k8s:production', '120 min', '2 approvers', true),
        ],
      ),
    );
  }

  Widget _buildUEBASection() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Behavioral Anomalies', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          ..._uebaAlertList.map((alert) => _buildAlertTile(alert)),
        ],
      ),
    );
  }

  Widget _buildDLPSection() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Data Loss Prevention Events', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          ..._dlpEvents.map((evt) => _buildDLPTile(evt)),
        ],
      ),
    );
  }

  Widget _buildCanarySection() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Canary Tokens', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ElevatedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Deploy'),
                style: ElevatedButton.styleFrom(backgroundColor: Colors.deepPurple),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ..._canaryTokens.map((token) => _buildCanaryTile(token)),
        ],
      ),
    );
  }

  Widget _buildAlertTile(Map<String, dynamic> alert) {
    final severityColor = {
      'critical': Colors.red, 'high': Colors.orange,
      'medium': Colors.amber, 'low': Colors.blue,
    }[alert['severity']] ?? Colors.grey;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(backgroundColor: severityColor, child: Icon(Icons.warning, color: Colors.white, size: 20)),
        title: Text('${alert['type']} — ${alert['employee']}', style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(alert['details'] ?? ''),
        trailing: Chip(label: Text(alert['severity']!.toUpperCase(), style: const TextStyle(fontSize: 10, color: Colors.white)), backgroundColor: severityColor),
      ),
    );
  }

  Widget _buildPAMTile(Map<String, dynamic> req) {
    final statusColor = req['status'] == 'active' ? Colors.green : Colors.orange;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(backgroundColor: statusColor, child: const Icon(Icons.lock, color: Colors.white, size: 20)),
        title: Text('${req['resource']}', style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('By: ${req['requestor']} | Duration: ${req['duration']}'),
        trailing: Chip(label: Text(req['status']!.toUpperCase(), style: const TextStyle(fontSize: 10)), backgroundColor: statusColor.withOpacity(0.2)),
        onTap: () {
          if (req['status'] == 'pending') _showApproveDialog(req);
        },
      ),
    );
  }

  Widget _buildPolicyTile(String resource, String maxDuration, String approvers, bool mfa) {
    return Card(
      margin: const EdgeInsets.only(bottom: 4),
      child: ListTile(
        dense: true,
        leading: const Icon(Icons.policy, size: 20),
        title: Text(resource, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        subtitle: Text('Max: $maxDuration | $approvers | MFA: ${mfa ? "Required" : "No"}', style: const TextStyle(fontSize: 11)),
      ),
    );
  }

  Widget _buildDLPTile(Map<String, dynamic> evt) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const CircleAvatar(backgroundColor: Colors.red, child: Icon(Icons.block, color: Colors.white, size: 20)),
        title: Text('${evt['rule']}', style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('Actor: ${evt['actor']} | Records: ${evt['records']}'),
        trailing: Chip(label: Text(evt['action']!.toUpperCase(), style: const TextStyle(fontSize: 10, color: Colors.white)), backgroundColor: Colors.red),
      ),
    );
  }

  Widget _buildCanaryTile(Map<String, dynamic> token) {
    final triggered = token['status'] == 'triggered';
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: triggered ? Colors.red.shade50 : null,
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: triggered ? Colors.red : Colors.deepPurple,
          child: Icon(triggered ? Icons.warning : Icons.pest_control, color: Colors.white, size: 20),
        ),
        title: Text('${token['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('Type: ${token['type']} | Triggers: ${token['triggers']}'),
        trailing: Chip(
          label: Text(token['status']!.toUpperCase(), style: TextStyle(fontSize: 10, color: triggered ? Colors.white : Colors.black87)),
          backgroundColor: triggered ? Colors.red : Colors.grey.shade200,
        ),
      ),
    );
  }

  void _showAlertDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Security Alerts'),
        content: SizedBox(
          width: double.maxFinite,
          height: 300,
          child: ListView(
            children: _uebaAlertList.map((a) => ListTile(
              dense: true,
              leading: Icon(Icons.warning, color: a['severity'] == 'critical' ? Colors.red : Colors.orange, size: 18),
              title: Text('${a['type']} — ${a['employee']}', style: const TextStyle(fontSize: 13)),
              subtitle: Text(a['details'] ?? '', style: const TextStyle(fontSize: 11)),
            )).toList(),
          ),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close'))],
      ),
    );
  }

  void _showBreakGlassDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(children: const [Icon(Icons.warning_amber, color: Colors.red), SizedBox(width: 8), Text('Break-Glass Access')]),
        content: const Text('This will activate emergency access and automatically create an incident ticket. '
            'All actions will be recorded. A post-incident review is mandatory.\n\n'
            'Are you sure you want to proceed?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () { Navigator.pop(ctx); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Break-glass activated — incident created'))); },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('ACTIVATE', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showPAMRequestDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Request Privileged Access'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(labelText: 'Resource'),
              items: ['database:core_banking', 'service:gl-engine', 'vault:secrets', 'k8s:production']
                  .map((r) => DropdownMenuItem(value: r, child: Text(r, style: const TextStyle(fontSize: 13))))
                  .toList(),
              onChanged: (_) {},
            ),
            const SizedBox(height: 8),
            const TextField(decoration: InputDecoration(labelText: 'Justification / Ticket Reference')),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(labelText: 'Duration'),
              items: ['30 min', '60 min', '120 min'].map((d) => DropdownMenuItem(value: d, child: Text(d))).toList(),
              onChanged: (_) {},
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(onPressed: () { Navigator.pop(ctx); }, child: const Text('Submit Request')),
        ],
      ),
    );
  }

  void _showApproveDialog(Map<String, dynamic> req) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Approve: ${req['resource']}'),
        content: Text('Requestor: ${req['requestor']}\nDuration: ${req['duration']}\n\nApprove this access request?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Deny')),
          ElevatedButton(onPressed: () { Navigator.pop(ctx); }, child: const Text('Approve')),
        ],
      ),
    );
  }
}
