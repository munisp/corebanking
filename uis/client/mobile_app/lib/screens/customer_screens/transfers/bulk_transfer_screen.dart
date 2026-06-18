import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../services/payment_service.dart';
import '../../../services/api_service.dart';

class TransferRow {
  String accountNumber;
  String accountName;
  String bankCode;
  String amount;
  String narration;

  TransferRow({
    this.accountNumber = '',
    this.accountName = '',
    this.bankCode = '',
    this.amount = '',
    this.narration = '',
  });

  Map<String, String> toMap() => {
        'accountNumber': accountNumber,
        'accountName': accountName,
        'bankCode': bankCode,
        'amount': amount,
        'narration': narration,
      };
}

class BulkTransferScreen extends StatefulWidget {
  const BulkTransferScreen({super.key});

  @override
  State<BulkTransferScreen> createState() => _BulkTransferScreenState();
}

class _BulkTransferScreenState extends State<BulkTransferScreen> {
  final List<TransferRow> _rows = [TransferRow()];
  final _pinController = TextEditingController();
  final _batchLabelController = TextEditingController();

  bool _isProcessing = false;
  bool _showConfirm = false;
  Map<String, dynamic>? _result;
  String _error = '';

  late final PaymentService _paymentService;

  @override
  void initState() {
    super.initState();
    _paymentService = PaymentService(ApiService());
  }

  @override
  void dispose() {
    _pinController.dispose();
    _batchLabelController.dispose();
    super.dispose();
  }

  double get _totalAmount => _rows.fold(0, (sum, r) => sum + (double.tryParse(r.amount) ?? 0));

  String? _validate() {
    if (_pinController.text.length < 4) return 'Enter your 4-digit PIN.';
    for (final r in _rows) {
      if (r.accountNumber.isEmpty) return 'All rows need an account number.';
      if (r.amount.isEmpty || (double.tryParse(r.amount) ?? 0) <= 0) {
        return 'All rows need a valid amount.';
      }
      if (r.narration.isEmpty) return 'All rows need a narration.';
    }
    return null;
  }

  Future<void> _submit() async {
    setState(() { _isProcessing = true; _showConfirm = false; _error = ''; });

    final res = await _paymentService.bulkPayment(
      batchId: _batchLabelController.text.isEmpty ? null : _batchLabelController.text,
      pin: _pinController.text,
      transfers: _rows.map((r) => r.toMap()).toList(),
    );

    setState(() { _isProcessing = false; });

    if (res['success'] == true) {
      setState(() { _result = res['data'] as Map<String, dynamic>?; });
    } else {
      setState(() { _error = res['message']?.toString() ?? 'Bulk payment failed'; });
    }
  }

  void _reset() {
    setState(() {
      _rows
        ..clear()
        ..add(TransferRow());
      _pinController.clear();
      _batchLabelController.clear();
      _result = null;
      _error = '';
    });
  }

  Color get _primaryColor => Theme.of(context).colorScheme.primary;

  // ── Results view ─────────────────────────────────────────────────────
  Widget _buildResults() {
    final results = (_result!['results'] as List<dynamic>? ?? []);
    final total = _result!['total'] ?? 0;
    final succeeded = _result!['succeeded'] ?? 0;
    final failed = _result!['failed'] ?? 0;
    final rate = (_result!['success_rate_pct'] as num?)?.toDouble() ?? 0;
    final batchId = _result!['batch_id'] ?? '';

    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          color: Colors.black87,
          onPressed: _reset,
        ),
        title: const Text('Batch Results', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.w600)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Summary card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [_primaryColor, _primaryColor.withOpacity(0.7)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Batch ID: $batchId', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _statChip('$total', 'Total', Colors.white),
                      _statChip('$succeeded', 'Passed', Colors.green[200]!),
                      _statChip('$failed', 'Failed', Colors.red[200]!),
                      _statChip('${rate.toStringAsFixed(0)}%', 'Success', Colors.white),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Per-item results
            ...results.asMap().entries.map((entry) {
              final item = entry.value as Map<String, dynamic>;
              final idx = item['index'] as int? ?? entry.key;
              final status = item['status'] as String? ?? '';
              final errMsg = item['error'] as String?;
              final row = idx < _rows.length ? _rows[idx] : null;
              final isSuccess = status == 'success';

              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isSuccess ? Colors.green[50] : Colors.red[50],
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isSuccess ? Colors.green[200]! : Colors.red[200]!,
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            row?.accountNumber ?? 'Row ${idx + 1}',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                          ),
                          if (row != null) ...[
                            const SizedBox(height: 2),
                            Text(
                              '₦${(double.tryParse(row.amount) ?? 0).toStringAsFixed(2)} · ${row.narration}',
                              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                            ),
                          ],
                          if (errMsg != null) ...[
                            const SizedBox(height: 4),
                            Text(errMsg, style: const TextStyle(fontSize: 12, color: Colors.red)),
                          ],
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: isSuccess ? Colors.green[100] : Colors.red[100],
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        status,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isSuccess ? Colors.green[800] : Colors.red[800],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),

            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _primaryColor,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _reset,
                child: const Text('New Batch', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statChip(String value, String label, Color valueColor) => Column(
        children: [
          Text(value, style: TextStyle(color: valueColor, fontSize: 22, fontWeight: FontWeight.bold)),
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
        ],
      );

  // ── Row card ─────────────────────────────────────────────────────────
  Widget _buildRowCard(int idx) {
    final row = _rows[idx];
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('#${idx + 1}', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.grey[600])),
                const Spacer(),
                if (_rows.length > 1)
                  IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                    onPressed: () => setState(() => _rows.removeAt(idx)),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            _inputField(
              label: 'Account Number *',
              value: row.accountNumber,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
              onChanged: (v) => setState(() => row.accountNumber = v),
            ),
            const SizedBox(height: 8),
            _inputField(
              label: 'Account Name (optional)',
              value: row.accountName,
              onChanged: (v) => setState(() => row.accountName = v),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _inputField(
                    label: 'Amount (₦) *',
                    value: row.amount,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    onChanged: (v) => setState(() => row.amount = v),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 110,
                  child: _inputField(
                    label: 'Bank Code',
                    value: row.bankCode,
                    keyboardType: TextInputType.number,
                    onChanged: (v) => setState(() => row.bankCode = v),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            _inputField(
              label: 'Narration *',
              value: row.narration,
              onChanged: (v) => setState(() => row.narration = v),
            ),
          ],
        ),
      ),
    );
  }

  Widget _inputField({
    required String label,
    required String value,
    required ValueChanged<String> onChanged,
    TextInputType keyboardType = TextInputType.text,
    List<TextInputFormatter>? inputFormatters,
  }) {
    return TextFormField(
      initialValue: value,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(fontSize: 13, color: Colors.grey[600]),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        filled: true,
        fillColor: Colors.grey[50],
      ),
      style: const TextStyle(fontSize: 14),
      onChanged: onChanged,
    );
  }

  // ── Confirm modal ─────────────────────────────────────────────────────
  void _showConfirmDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        builder: (_, controller) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text('Confirm Batch', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _primaryColor)),
                  const Spacer(),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
              const Divider(),
              Expanded(
                child: ListView.separated(
                  controller: controller,
                  itemCount: _rows.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final r = _rows[i];
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(r.accountName.isEmpty ? r.accountNumber : r.accountName,
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                Text(r.narration, style: TextStyle(fontSize: 12, color: Colors.grey[500])),
                              ],
                            ),
                          ),
                          Text('₦${(double.tryParse(r.amount) ?? 0).toStringAsFixed(2)}',
                              style: const TextStyle(fontWeight: FontWeight.w600)),
                        ],
                      ),
                    );
                  },
                ),
              ),
              const Divider(),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    const Text('Total', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    const Spacer(),
                    Text('₦${_totalAmount.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  ],
                ),
              ),
              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _primaryColor,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () { Navigator.pop(ctx); _submit(); },
                  child: const Text('Send Batch', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_result != null) return _buildResults();

    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          color: Colors.black87,
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Bulk Transfer', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.w600)),
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Banner
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [_primaryColor, _primaryColor.withOpacity(0.7)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(12)),
                        child: const Icon(Icons.send_rounded, color: Colors.white, size: 28),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Bulk Transfer', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                            Text('Send to multiple accounts at once', style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // Summary row
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Row(
                    children: [
                      Text('${_rows.length} recipient${_rows.length != 1 ? 's' : ''}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                      const Spacer(),
                      Text('₦${_totalAmount.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    ],
                  ),
                ),

                // Batch label
                TextFormField(
                  controller: _batchLabelController,
                  decoration: InputDecoration(
                    labelText: 'Batch Label (Optional)',
                    hintText: 'e.g. June Salaries',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey[300]!)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey[300]!)),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  ),
                ),
                const SizedBox(height: 16),

                // Recipients header
                Row(
                  children: [
                    const Text('Recipients', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: () => setState(() => _rows.add(TransferRow())),
                      icon: Icon(Icons.add, color: _primaryColor, size: 18),
                      label: Text('Add Row', style: TextStyle(color: _primaryColor, fontWeight: FontWeight.w600)),
                      style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4)),
                    ),
                  ],
                ),
                const SizedBox(height: 4),

                // Row cards
                ...List.generate(_rows.length, (i) => _buildRowCard(i)),

                const SizedBox(height: 8),

                // PIN
                const Text('PIN *', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _pinController,
                  obscureText: true,
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: InputDecoration(
                    hintText: 'Enter 4-digit PIN',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey[300]!)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey[300]!)),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    counterText: '',
                  ),
                ),

                if (_error.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red[50],
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.red[200]!),
                    ),
                    child: Text(_error, style: const TextStyle(color: Colors.red, fontSize: 13)),
                  ),
                ],
              ],
            ),
          ),

          // Submit button pinned at bottom
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12, offset: const Offset(0, -4))],
              ),
              child: SizedBox(
                height: 54,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _primaryColor,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _isProcessing
                      ? null
                      : () {
                          final err = _validate();
                          if (err != null) {
                            setState(() => _error = err);
                          } else {
                            setState(() => _error = '');
                            _showConfirmDialog();
                          }
                        },
                  child: _isProcessing
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                      : const Text('Review & Send', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
