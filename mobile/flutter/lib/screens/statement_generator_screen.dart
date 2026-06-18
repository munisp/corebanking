import 'package:flutter/material.dart';

class StatementGeneratorScreen extends StatefulWidget {
  const StatementGeneratorScreen({super.key});
  @override
  State<StatementGeneratorScreen> createState() => _StatementGeneratorScreenState();
}

class _StatementGeneratorScreenState extends State<StatementGeneratorScreen> {
  String _selectedAccount = '0012345678 - Savings';
  String _format = 'PDF';
  DateTimeRange? _dateRange;
  bool _includeBalance = true;
  bool _includeNarrations = true;
  bool _isGenerating = false;

  final List<String> _accounts = [
    '0012345678 - Savings',
    '0023456789 - Current',
    '0034567890 - Domiciliary (USD)',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Generate Statement')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Account', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: _selectedAccount,
            items: _accounts.map((a) => DropdownMenuItem(value: a, child: Text(a))).toList(),
            onChanged: (v) => setState(() => _selectedAccount = v!),
            decoration: const InputDecoration(border: OutlineInputBorder()),
          ),
          const SizedBox(height: 16),
          const Text('Date Range', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            icon: const Icon(Icons.date_range),
            label: Text(_dateRange != null
              ? '${_dateRange!.start.day}/${_dateRange!.start.month}/${_dateRange!.start.year} - ${_dateRange!.end.day}/${_dateRange!.end.month}/${_dateRange!.end.year}'
              : 'Select date range'),
            onPressed: () async {
              final range = await showDateRangePicker(context: context,
                firstDate: DateTime(2020), lastDate: DateTime.now());
              if (range != null) setState(() => _dateRange = range);
            },
          ),
          const SizedBox(height: 8),
          Wrap(spacing: 8, children: [
            ChoiceChip(label: const Text('Last 30 days'), selected: false,
              onSelected: (_) => setState(() => _dateRange = DateTimeRange(
                start: DateTime.now().subtract(const Duration(days: 30)), end: DateTime.now()))),
            ChoiceChip(label: const Text('Last 90 days'), selected: false,
              onSelected: (_) => setState(() => _dateRange = DateTimeRange(
                start: DateTime.now().subtract(const Duration(days: 90)), end: DateTime.now()))),
            ChoiceChip(label: const Text('Last 6 months'), selected: false,
              onSelected: (_) => setState(() => _dateRange = DateTimeRange(
                start: DateTime.now().subtract(const Duration(days: 180)), end: DateTime.now()))),
          ]),
          const SizedBox(height: 16),
          const Text('Format', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'PDF', label: Text('PDF')),
              ButtonSegment(value: 'CSV', label: Text('CSV')),
              ButtonSegment(value: 'Excel', label: Text('Excel')),
            ],
            selected: {_format},
            onSelectionChanged: (v) => setState(() => _format = v.first),
          ),
          const SizedBox(height: 16),
          const Text('Options', style: TextStyle(fontWeight: FontWeight.bold)),
          CheckboxListTile(title: const Text('Include running balance'), value: _includeBalance,
            onChanged: (v) => setState(() => _includeBalance = v!)),
          CheckboxListTile(title: const Text('Include narrations'), value: _includeNarrations,
            onChanged: (v) => setState(() => _includeNarrations = v!)),
          const SizedBox(height: 24),
          SizedBox(width: double.infinity, child: ElevatedButton.icon(
            icon: _isGenerating ? const SizedBox(width: 16, height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.download),
            label: Text(_isGenerating ? 'Generating...' : 'Generate Statement'),
            onPressed: _dateRange != null && !_isGenerating ? () {
              setState(() => _isGenerating = true);
              Future.delayed(const Duration(seconds: 2), () {
                setState(() => _isGenerating = false);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Statement generated and sent to your email')));
              });
            } : null,
          )),
          const SizedBox(height: 8),
          const Center(child: Text('Stamped statements attract \u20A6500 per copy',
            style: TextStyle(color: Colors.grey, fontSize: 12))),
        ]),
      ),
    );
  }
}
