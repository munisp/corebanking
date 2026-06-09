import 'package:flutter/material.dart';

class ExamManagementScreen extends StatefulWidget {
  const ExamManagementScreen({super.key});
  @override
  State<ExamManagementScreen> createState() => _ExamManagementScreenState();
}

class _ExamManagementScreenState extends State<ExamManagementScreen> {
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
      appBar: AppBar(title: const Text('Exam Management'), backgroundColor: Colors.green[700]),
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
              _kpi('CBN Exams', '4/yr', Icons.school),
              _kpi('Findings', '12', Icons.find_in_page),
              _kpi('Remediated', '10', Icons.check),
              _kpi('Outstanding', '2', Icons.warning),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('CBN Routine Examination'),
              subtitle: Text('Annual'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Last: Nov 2023', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('NDIC Special Exam'),
              subtitle: Text('Ad-hoc'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Last: Aug 2023', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Internal Audit Review'),
              subtitle: Text('Quarterly'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Last: Dec 2023', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('External Audit (KPMG)'),
              subtitle: Text('Annual'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Unqualified Opinion', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
