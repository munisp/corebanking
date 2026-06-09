import 'package:flutter/material.dart';

class JournalEntriesScreen extends StatefulWidget {
  const JournalEntriesScreen({super.key});
  @override
  State<JournalEntriesScreen> createState() => _JournalEntriesScreenState();
}

class _JournalEntriesScreenState extends State<JournalEntriesScreen> {
  final List<Map<String, dynamic>> _entries = [
    {'ref': 'JV-2024-0045', 'date': '2024-01-15', 'type': 'Manual', 'lines': 2, 'total': 12500000, 'status': 'Posted', 'approver': 'CFO'},
    {'ref': 'JV-2024-0044', 'date': '2024-01-15', 'type': 'Auto', 'lines': 4, 'total': 45000000, 'status': 'Posted', 'approver': 'System'},
    {'ref': 'JV-2024-0043', 'date': '2024-01-14', 'type': 'Manual', 'lines': 6, 'total': 8900000, 'status': 'Pending', 'approver': '-'},
    {'ref': 'JV-2024-0042', 'date': '2024-01-14', 'type': 'Reversal', 'lines': 2, 'total': 3200000, 'status': 'Posted', 'approver': 'Head Ops'},
    {'ref': 'JV-2024-0041', 'date': '2024-01-13', 'type': 'Auto', 'lines': 8, 'total': 67800000, 'status': 'Posted', 'approver': 'System'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Journal Entries'), actions: [
        IconButton(icon: const Icon(Icons.add), onPressed: () {}, tooltip: 'New Entry'),
        IconButton(icon: const Icon(Icons.filter_list), onPressed: () {}, tooltip: 'Filter'),
      ]),
      body: ListView.builder(itemCount: _entries.length, itemBuilder: (ctx, i) {
        final e = _entries[i];
        final statusColor = e['status'] == 'Posted' ? Colors.green : Colors.orange;
        return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ListTile(
          leading: CircleAvatar(backgroundColor: statusColor.withOpacity(0.1),
            child: Icon(e['type'] == 'Manual' ? Icons.edit : e['type'] == 'Auto' ? Icons.autorenew : Icons.undo, color: statusColor)),
          title: Text('${e["ref"]} (${e["type"]})'), subtitle: Text('${e["date"]} | ${e["lines"]} lines | Approved by: ${e["approver"]}'),
          trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text('₦${((e["total"] as int) / 100).toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold)),
            Chip(label: Text(e['status'] as String, style: const TextStyle(fontSize: 10)), backgroundColor: statusColor.withOpacity(0.1)),
          ]),
        ));
      }),
    );
  }
}
