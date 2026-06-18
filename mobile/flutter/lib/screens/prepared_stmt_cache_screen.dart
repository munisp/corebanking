import 'package:flutter/material.dart';

class PreparedStmtCacheScreen extends StatefulWidget {
  const PreparedStmtCacheScreen({super.key});
  @override
  State<PreparedStmtCacheScreen> createState() => _PreparedStmtCacheScreenState();
}

class _PreparedStmtCacheScreenState extends State<PreparedStmtCacheScreen> {
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
      appBar: AppBar(title: const Text('Prepared Stmt Cache'), backgroundColor: Colors.green[700]),
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
              _kpi('Cached Stmts', '2,500', Icons.cached),
              _kpi('Hit Rate', '99.8%', Icons.flash_on),
              _kpi('Parse Saved', '85K/s', Icons.speed),
              _kpi('Memory', '256MB', Icons.memory),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Balance Inquiry Stmt'),
              subtitle: Text('SELECT'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('45K hits/s', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Cached', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Insert Transaction Stmt'),
              subtitle: Text('INSERT'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('25K hits/s', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Cached', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Update Balance Stmt'),
              subtitle: Text('UPDATE'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('12K hits/s', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Cached', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Audit Insert Stmt'),
              subtitle: Text('INSERT'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('8K hits/s', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Cached', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
