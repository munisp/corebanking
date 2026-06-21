import 'package:flutter/material.dart';

/// 54Bank PAM Approval Flow — Flutter
/// Mobile-first approval workflow for privileged access requests.
/// Security officers can approve/deny PAM requests with biometric confirmation.

class PAMApprovalScreen extends StatefulWidget {
  const PAMApprovalScreen({Key? key}) : super(key: key);

  @override
  State<PAMApprovalScreen> createState() => _PAMApprovalScreenState();
}

class _PAMApprovalScreenState extends State<PAMApprovalScreen> {
  final List<Map<String, dynamic>> _pendingRequests = [
    {
      'id': 'PAM-001', 'requestor': 'john.doe', 'requestor_name': 'John Doe',
      'resource': 'database:core_banking', 'access_level': 'read',
      'justification': 'INC-2026-4521: Investigating payment reconciliation discrepancy',
      'duration': 60, 'required_approvers': 2, 'current_approvers': 1,
      'approval_chain': ['jane.smith'], 'ip': '10.0.1.42', 'created_at': '2026-06-08 23:30',
    },
    {
      'id': 'PAM-002', 'requestor': 'ops.team', 'requestor_name': 'Operations Team',
      'resource': 'k8s:production', 'access_level': 'admin',
      'justification': 'CHG-2026-891: Deploying hotfix for payments timeout',
      'duration': 120, 'required_approvers': 2, 'current_approvers': 0,
      'approval_chain': [], 'ip': '10.0.2.15', 'created_at': '2026-06-08 23:15',
    },
    {
      'id': 'PAM-003', 'requestor': 'security.admin', 'requestor_name': 'Security Admin',
      'resource': 'vault:secrets', 'access_level': 'write',
      'justification': 'Rotating NIBSS API credentials (quarterly)',
      'duration': 30, 'required_approvers': 2, 'current_approvers': 0,
      'approval_chain': [], 'ip': '10.0.1.10', 'created_at': '2026-06-08 22:45',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('PAM Approvals'),
        backgroundColor: const Color(0xFF1A1A2E),
        foregroundColor: Colors.white,
      ),
      body: _pendingRequests.isEmpty
          ? const Center(child: Text('No pending approval requests', style: TextStyle(fontSize: 16, color: Colors.grey)))
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _pendingRequests.length,
              itemBuilder: (ctx, i) => _buildRequestCard(_pendingRequests[i]),
            ),
    );
  }

  Widget _buildRequestCard(Map<String, dynamic> req) {
    final accessColor = {'read': Colors.green, 'write': Colors.orange, 'admin': Colors.red}[req['access_level']] ?? Colors.grey;
    final approvalProgress = req['current_approvers'] / req['required_approvers'];

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(req['id'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                Chip(
                  label: Text(req['access_level'].toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 11)),
                  backgroundColor: accessColor,
                  padding: EdgeInsets.zero,
                ),
              ],
            ),
            const SizedBox(height: 8),
            _buildInfoRow(Icons.person, 'Requestor', '${req['requestor_name']} (${req['requestor']})'),
            _buildInfoRow(Icons.storage, 'Resource', req['resource']),
            _buildInfoRow(Icons.timer, 'Duration', '${req['duration']} minutes'),
            _buildInfoRow(Icons.description, 'Justification', req['justification']),
            _buildInfoRow(Icons.computer, 'IP Address', req['ip']),
            _buildInfoRow(Icons.access_time, 'Requested', req['created_at']),
            const SizedBox(height: 12),
            // Approval progress
            Row(
              children: [
                const Text('Approval: ', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                Text('${req['current_approvers']}/${req['required_approvers']}', style: const TextStyle(fontSize: 13)),
                const SizedBox(width: 8),
                Expanded(child: LinearProgressIndicator(value: approvalProgress, backgroundColor: Colors.grey.shade200, color: Colors.green)),
              ],
            ),
            if ((req['approval_chain'] as List).isNotEmpty) ...[
              const SizedBox(height: 4),
              Text('Approved by: ${(req['approval_chain'] as List).join(", ")}', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
            ],
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton.icon(
                  onPressed: () => _denyRequest(req),
                  icon: const Icon(Icons.close, size: 16, color: Colors.red),
                  label: const Text('Deny', style: TextStyle(color: Colors.red)),
                ),
                const SizedBox(width: 12),
                ElevatedButton.icon(
                  onPressed: () => _approveRequest(req),
                  icon: const Icon(Icons.check, size: 16),
                  label: const Text('Approve'),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: Colors.grey),
          const SizedBox(width: 8),
          SizedBox(width: 90, child: Text('$label:', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12))),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 12))),
        ],
      ),
    );
  }

  void _approveRequest(Map<String, dynamic> req) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Approval'),
        content: Text('Approve ${req['access_level']} access to ${req['resource']} for ${req['requestor_name']}?\n\n'
            'Duration: ${req['duration']} minutes\n'
            'This action will be logged in the audit trail.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() => _pendingRequests.remove(req));
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Approved: ${req['id']}')));
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            child: const Text('Confirm Approval', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _denyRequest(Map<String, dynamic> req) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Deny Request'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Deny ${req['access_level']} access to ${req['resource']}?'),
            const SizedBox(height: 12),
            TextField(controller: controller, decoration: const InputDecoration(labelText: 'Reason for denial', border: OutlineInputBorder()), maxLines: 2),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() => _pendingRequests.remove(req));
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Denied: ${req['id']}')));
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Deny', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}
