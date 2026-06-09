import 'package:flutter/material.dart';

class KYCWorkflowScreen extends StatefulWidget {
  const KYCWorkflowScreen({super.key});
  @override
  State<KYCWorkflowScreen> createState() => _KYCWorkflowScreenState();
}

class _KYCWorkflowScreenState extends State<KYCWorkflowScreen> {
  Widget _kpi(String label, String value, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Colors.green[700], size: 20),
            const Spacer(),
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Kyc Workflow'), backgroundColor: Colors.green[700]),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.6,
              children: [
              _kpi('Workflows Running', '3,000', Icons.account_tree),
              _kpi('Avg Completion', '2.5hr', Icons.timer),
              _kpi('Auto-approved', '72%', Icons.auto_fix_high),
              _kpi('Pending Review', '850', Icons.pending),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('BVN Verification Step'),
              subtitle: Text('API Call'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('NIBSS BVN API', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Auto', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('NIN Verification Step'),
              subtitle: Text('API Call'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('NIMC NIN API', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Auto', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Liveness Check Step'),
              subtitle: Text('Video KYC'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('AI face match', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Auto', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Manual Review Step'),
              subtitle: Text('Human-in-loop'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Compliance officer', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Queue', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
