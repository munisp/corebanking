import 'package:flutter/material.dart';

/// Bulk Payments — CSV upload, batch processing, approval workflow
class BulkPaymentsScreen extends StatefulWidget {
  const BulkPaymentsScreen({super.key});
  @override
  State<BulkPaymentsScreen> createState() => _BulkPaymentsScreenState();
}

class _BulkPaymentsScreenState extends State<BulkPaymentsScreen> {
  bool _isUploading = false;
  bool _isProcessing = false;
  List<Map<String, dynamic>>? _parsedBatch;
  int _processedCount = 0;
  String _batchStatus = 'idle'; // idle, uploaded, validating, approved, processing, complete

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bulk Payments')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status card
            Card(
              color: _statusColor.withOpacity(0.1),
              child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [
                Icon(_statusIcon, color: _statusColor, size: 32),
                const SizedBox(width: 12),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_statusText, style: TextStyle(fontWeight: FontWeight.bold, color: _statusColor)),
                  if (_parsedBatch != null) Text('${_parsedBatch!.length} payments | ₦${_totalAmount}'),
                ]),
              ])),
            ),
            const SizedBox(height: 24),

            // Upload section
            if (_batchStatus == 'idle') ...[
              Container(
                height: 200,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300, width: 2, style: BorderStyle.solid),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: InkWell(
                  onTap: _uploadCSV,
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.cloud_upload, size: 48, color: Colors.grey.shade400),
                    const SizedBox(height: 12),
                    const Text('Upload CSV File', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text('Format: account_number, bank_code, amount, narration', style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                    const SizedBox(height: 8),
                    Text('Max: 10,000 records per batch', style: TextStyle(color: Colors.grey.shade400, fontSize: 11)),
                  ]),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Or paste directly:', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              TextField(maxLines: 5, decoration: InputDecoration(
                hintText: '0123456789,058,500000,Salary June\n9876543210,033,250000,Salary June',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              )),
            ],

            // Validation results
            if (_parsedBatch != null && _batchStatus == 'uploaded') ...[
              const SizedBox(height: 16),
              const Text('Validation Summary', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              _summaryRow('Total Records', '${_parsedBatch!.length}'),
              _summaryRow('Total Amount', '₦$_totalAmount'),
              _summaryRow('Valid', '${_parsedBatch!.where((p) => p["valid"] == true).length}'),
              _summaryRow('Invalid', '${_parsedBatch!.where((p) => p["valid"] != true).length}', isError: true),
              const SizedBox(height: 16),
              // Preview table
              DataTable(
                columns: const [DataColumn(label: Text('Account')), DataColumn(label: Text('Bank')), DataColumn(label: Text('Amount')), DataColumn(label: Text('Status'))],
                rows: _parsedBatch!.take(5).map((p) => DataRow(cells: [
                  DataCell(Text(p['account'])),
                  DataCell(Text(p['bank'])),
                  DataCell(Text('₦${p['amount']}')),
                  DataCell(Icon(p['valid'] == true ? Icons.check_circle : Icons.error, color: p['valid'] == true ? Colors.green : Colors.red, size: 16)),
                ])).toList(),
              ),
              const SizedBox(height: 24),
              Row(children: [
                Expanded(child: OutlinedButton(onPressed: () => setState(() { _parsedBatch = null; _batchStatus = 'idle'; }), child: const Text('Cancel'))),
                const SizedBox(width: 12),
                Expanded(child: ElevatedButton(onPressed: _submitForApproval, style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                    child: const Text('Submit for Approval', style: TextStyle(color: Colors.white)))),
              ]),
            ],

            // Processing progress
            if (_batchStatus == 'processing') ...[
              const SizedBox(height: 24),
              LinearProgressIndicator(value: _processedCount / (_parsedBatch?.length ?? 1)),
              const SizedBox(height: 8),
              Text('Processing: $_processedCount / ${_parsedBatch?.length ?? 0}', textAlign: TextAlign.center),
            ],

            // Complete
            if (_batchStatus == 'complete') ...[
              const SizedBox(height: 24),
              const Icon(Icons.check_circle, color: Colors.green, size: 64),
              const SizedBox(height: 12),
              const Text('Batch Complete!', textAlign: TextAlign.center, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              Text('$_processedCount payments processed', textAlign: TextAlign.center),
              const SizedBox(height: 16),
              OutlinedButton.icon(icon: const Icon(Icons.download), label: const Text('Download Report'), onPressed: () {}),
            ],
          ],
        ),
      ),
    );
  }

  Color get _statusColor => {'idle': Colors.grey, 'uploaded': Colors.blue, 'validating': Colors.orange,
      'approved': Colors.green, 'processing': Colors.purple, 'complete': Colors.green}[_batchStatus] ?? Colors.grey;
  IconData get _statusIcon => {'idle': Icons.upload_file, 'uploaded': Icons.fact_check, 'validating': Icons.hourglass_top,
      'approved': Icons.verified, 'processing': Icons.sync, 'complete': Icons.done_all}[_batchStatus] ?? Icons.upload_file;
  String get _statusText => {'idle': 'Ready to Upload', 'uploaded': 'Validation Complete', 'validating': 'Validating...',
      'approved': 'Approved', 'processing': 'Processing...', 'complete': 'Complete'}[_batchStatus] ?? '';
  String get _totalAmount => _parsedBatch?.fold<int>(0, (sum, p) => sum + (p['amount'] as int? ?? 0)).toString()
      .replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},') ?? '0';

  Widget _summaryRow(String label, String value, {bool isError = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label), Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: isError ? Colors.red : null))]),
  );

  void _uploadCSV() {
    setState(() => _isUploading = true);
    Future.delayed(const Duration(seconds: 1), () {
      setState(() {
        _isUploading = false;
        _batchStatus = 'uploaded';
        _parsedBatch = List.generate(25, (i) => {
          'account': '${1000000000 + i}', 'bank': ['GTBank', 'Access', 'UBA', 'Zenith', 'First Bank'][i % 5],
          'amount': (50000 + i * 10000), 'narration': 'Salary June 2026', 'valid': i != 7,
        });
      });
    });
  }

  void _submitForApproval() {
    setState(() => _batchStatus = 'processing');
    _processNext();
  }

  void _processNext() {
    if (_processedCount >= (_parsedBatch?.length ?? 0)) {
      setState(() => _batchStatus = 'complete');
      return;
    }
    Future.delayed(const Duration(milliseconds: 200), () {
      setState(() => _processedCount++);
      _processNext();
    });
  }
}
