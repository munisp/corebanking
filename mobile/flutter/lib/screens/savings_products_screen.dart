import 'package:flutter/material.dart';

class SavingsProductsScreen extends StatefulWidget {
  const SavingsProductsScreen({super.key});
  @override
  State<SavingsProductsScreen> createState() => _SavingsProductsScreenState();
}

class _SavingsProductsScreenState extends State<SavingsProductsScreen> {
  final _goalNameController = TextEditingController();
  final _targetAmountController = TextEditingController();
  String _frequency = 'monthly';
  bool _autoDebit = true;

  final List<Map<String, dynamic>> _goals = [
    {'name': 'House Fund', 'target': 5000000, 'saved': 2350000, 'frequency': 'monthly', 'autoDebit': true, 'startDate': '2024-01-15', 'dueDate': '2025-06-15', 'rate': '10.0%'},
    {'name': 'Emergency Fund', 'target': 1000000, 'saved': 875000, 'frequency': 'weekly', 'autoDebit': true, 'startDate': '2024-03-01', 'dueDate': '2024-12-31', 'rate': '7.5%'},
    {'name': 'Vacation', 'target': 500000, 'saved': 500000, 'frequency': 'monthly', 'autoDebit': false, 'startDate': '2024-01-01', 'dueDate': '2024-06-30', 'rate': '5.0%'},
  ];

  String _formatNGN(int amount) => 'NGN ${amount.toString().replaceAllMapped(RegExp(r"(\d)(?=(\d{3})+(?!\d))"), (m) => "${m[1]},")}';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Savings Goals')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateGoalDialog,
        icon: const Icon(Icons.add),
        label: const Text('New Goal'),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _goals.length + 1,
        itemBuilder: (ctx, i) {
          if (i == 0) return _buildSummaryCard();
          return _buildGoalCard(_goals[i - 1]);
        },
      ),
    );
  }

  Widget _buildSummaryCard() {
    final totalSaved = _goals.fold<int>(0, (sum, g) => sum + (g['saved'] as int));
    final totalTarget = _goals.fold<int>(0, (sum, g) => sum + (g['target'] as int));
    return Card(
      color: Theme.of(context).colorScheme.primaryContainer,
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
        const Text('Total Savings', style: TextStyle(fontSize: 14)),
        Text(_formatNGN(totalSaved), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        LinearProgressIndicator(value: totalSaved / totalTarget, minHeight: 8),
        const SizedBox(height: 4),
        Text('${(totalSaved / totalTarget * 100).toStringAsFixed(1)}% of ${_formatNGN(totalTarget)}'),
      ])),
    );
  }

  Widget _buildGoalCard(Map<String, dynamic> goal) {
    final progress = (goal['saved'] as int) / (goal['target'] as int);
    final isComplete = progress >= 1.0;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(padding: const EdgeInsets.all(16), child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(goal['name'], style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            if (isComplete) const Chip(label: Text('Complete', style: TextStyle(color: Colors.green, fontSize: 12)), backgroundColor: Color(0xFFE8F5E9)),
            if (!isComplete && goal['autoDebit']) const Chip(label: Text('Auto-Debit', style: TextStyle(fontSize: 11)), backgroundColor: Color(0xFFE3F2FD)),
          ]),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(_formatNGN(goal['saved']), style: const TextStyle(fontWeight: FontWeight.w600)),
            Text('of ${_formatNGN(goal["target"])}', style: TextStyle(color: Colors.grey.shade600)),
          ]),
          const SizedBox(height: 6),
          ClipRRect(borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(value: progress.clamp(0.0, 1.0), minHeight: 10,
              backgroundColor: Colors.grey.shade200,
              color: isComplete ? Colors.green : null)),
          const SizedBox(height: 8),
          Row(children: [
            Icon(Icons.calendar_today, size: 14, color: Colors.grey.shade600),
            const SizedBox(width: 4),
            Text('Due: ${goal["dueDate"]}', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(width: 16),
            Icon(Icons.percent, size: 14, color: Colors.grey.shade600),
            const SizedBox(width: 4),
            Text('${goal["rate"]} p.a.', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          ]),
          if (!isComplete) ...[
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: OutlinedButton.icon(
                icon: const Icon(Icons.add_circle_outline, size: 18),
                label: const Text('Quick Save'),
                onPressed: () => _showQuickSaveDialog(goal),
              )),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton.icon(
                icon: const Icon(Icons.history, size: 18),
                label: const Text('History'),
                onPressed: () {},
              )),
            ]),
          ],
        ],
      )),
    );
  }

  void _showQuickSaveDialog(Map<String, dynamic> goal) {
    final amountController = TextEditingController();
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: Text('Save to ${goal["name"]}'),
      content: TextField(
        controller: amountController,
        decoration: const InputDecoration(labelText: 'Amount (NGN)', prefixIcon: Icon(Icons.payments), border: OutlineInputBorder()),
        keyboardType: TextInputType.number,
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        ElevatedButton(onPressed: () {
          final amount = int.tryParse(amountController.text) ?? 0;
          if (amount > 0) {
            setState(() => goal['saved'] = (goal['saved'] as int) + amount);
            Navigator.pop(ctx);
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${_formatNGN(amount)} saved to ${goal["name"]}'), backgroundColor: Colors.green));
          }
        }, child: const Text('Save')),
      ],
    ));
  }

  void _showCreateGoalDialog() {
    showModalBottomSheet(context: context, isScrollControlled: true, builder: (ctx) => Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(ctx).viewInsets.bottom + 16),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('Create Savings Goal', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        TextField(controller: _goalNameController, decoration: const InputDecoration(labelText: 'Goal Name', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        TextField(controller: _targetAmountController, decoration: const InputDecoration(labelText: 'Target Amount (NGN)', border: OutlineInputBorder()), keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          value: _frequency, decoration: const InputDecoration(labelText: 'Savings Frequency', border: OutlineInputBorder()),
          items: const [
            DropdownMenuItem(value: 'daily', child: Text('Daily')),
            DropdownMenuItem(value: 'weekly', child: Text('Weekly')),
            DropdownMenuItem(value: 'monthly', child: Text('Monthly')),
          ],
          onChanged: (v) => setState(() => _frequency = v!),
        ),
        const SizedBox(height: 12),
        SwitchListTile(title: const Text('Enable Auto-Debit'), value: _autoDebit, onChanged: (v) => setState(() => _autoDebit = v)),
        const SizedBox(height: 16),
        SizedBox(width: double.infinity, child: ElevatedButton(
          onPressed: () {
            final target = int.tryParse(_targetAmountController.text) ?? 0;
            if (_goalNameController.text.isNotEmpty && target > 0) {
              setState(() => _goals.add({
                'name': _goalNameController.text, 'target': target, 'saved': 0,
                'frequency': _frequency, 'autoDebit': _autoDebit,
                'startDate': DateTime.now().toIso8601String().substring(0, 10),
                'dueDate': DateTime.now().add(const Duration(days: 365)).toIso8601String().substring(0, 10),
                'rate': '7.5%',
              }));
              _goalNameController.clear(); _targetAmountController.clear();
              Navigator.pop(ctx);
            }
          },
          child: const Text('Create Goal'),
        )),
      ]),
    ));
  }
}
