import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../../../services/trade_finance_service.dart';
import '../../../models/error_response.dart';
import '../../../widgets/error_snackbar.dart';

class BankGuaranteeApplyScreen extends StatefulWidget {
  const BankGuaranteeApplyScreen({super.key});

  @override
  State<BankGuaranteeApplyScreen> createState() =>
      _BankGuaranteeApplyScreenState();
}

class _BankGuaranteeApplyScreenState extends State<BankGuaranteeApplyScreen> {
  final _service = TradeFinanceService();
  final _formKey = GlobalKey<FormState>();
  final _beneficiaryController = TextEditingController();
  final _amountController = TextEditingController();
  final _expiryController = TextEditingController();
  final _purposeController = TextEditingController();

  String _type = 'performance';
  String _currency = 'NGN';
  bool _loading = false;

  static const _types = [
    'performance',
    'payment',
    'bid_bond',
    'advance_payment',
  ];
  static const _currencies = ['NGN', 'USD', 'EUR', 'GBP'];

  Future<void> _pickExpiry() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 180)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 5)),
    );
    if (picked != null) {
      setState(() {
        _expiryController.text =
            '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    final data = <String, dynamic>{
      'type': _type,
      'beneficiary_name': _beneficiaryController.text.trim(),
      'amount': double.parse(_amountController.text),
      'currency': _currency,
    };
    if (_expiryController.text.isNotEmpty) {
      data['expiry_date'] = _expiryController.text;
    }
    if (_purposeController.text.trim().isNotEmpty) {
      data['purpose'] = _purposeController.text.trim();
    }

    try {
      final response = await _service.createBankGuarantee(data);
      if (!mounted) return;
      setState(() => _loading = false);
      if (response.statusCode == 200 || response.statusCode == 201) {
        ErrorSnackbar.showSuccess(context, 'Bank guarantee request submitted!');
        Navigator.pop(context, true);
      } else {
        ErrorSnackbar.show(context, 'Failed to submit guarantee request');
      }
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      if (e.response?.data != null) {
        try {
          final err = ErrorResponse.fromJson(e.response!.data);
          ErrorSnackbar.showError(context, err, showErrorCode: true);
        } catch (_) {
          ErrorSnackbar.show(context, e.message ?? 'Failed to submit');
        }
      } else {
        ErrorSnackbar.show(context, e.message ?? 'Network error');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ErrorSnackbar.show(context, e.toString());
    }
  }

  @override
  void dispose() {
    _beneficiaryController.dispose();
    _amountController.dispose();
    _expiryController.dispose();
    _purposeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(title: const Text('Request Bank Guarantee')),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),
                  Text('Guarantee Details',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),

                  DropdownButtonFormField<String>(
                    value: _type,
                    decoration:
                        const InputDecoration(labelText: 'Guarantee Type *'),
                    items: _types.map((t) {
                      final label = t
                          .replaceAll('_', ' ')
                          .split(' ')
                          .map((w) => w.isNotEmpty
                              ? w[0].toUpperCase() + w.substring(1)
                              : w)
                          .join(' ');
                      return DropdownMenuItem(
                          value: t, child: Text(label));
                    }).toList(),
                    onChanged: (val) =>
                        setState(() => _type = val ?? 'performance'),
                  ),
                  const SizedBox(height: 12),

                  TextFormField(
                    controller: _beneficiaryController,
                    decoration: const InputDecoration(
                        labelText: 'Beneficiary Name *'),
                    validator: (v) =>
                        v == null || v.trim().isEmpty
                            ? 'Enter beneficiary name'
                            : null,
                  ),
                  const SizedBox(height: 20),

                  Text('Financial Terms',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: TextFormField(
                          controller: _amountController,
                          decoration: const InputDecoration(
                              labelText: 'Amount *'),
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          validator: (v) {
                            if (v == null || v.isEmpty) return 'Enter amount';
                            final n = double.tryParse(v);
                            if (n == null || n <= 0) return 'Invalid amount';
                            return null;
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: DropdownButtonFormField<String>(
                          value: _currency,
                          decoration: const InputDecoration(
                              labelText: 'Currency *'),
                          items: _currencies
                              .map((c) => DropdownMenuItem(
                                  value: c, child: Text(c)))
                              .toList(),
                          onChanged: (val) =>
                              setState(() => _currency = val ?? 'NGN'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  TextFormField(
                    controller: _expiryController,
                    readOnly: true,
                    decoration: InputDecoration(
                      labelText: 'Expiry Date (optional)',
                      suffixIcon: IconButton(
                        icon: const Icon(Icons.calendar_today_outlined),
                        onPressed: _pickExpiry,
                      ),
                    ),
                    onTap: _pickExpiry,
                  ),
                  const SizedBox(height: 20),

                  Text('Purpose',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),

                  TextFormField(
                    controller: _purposeController,
                    decoration: const InputDecoration(
                        labelText: 'Purpose / Description (optional)',
                        alignLabelWithHint: true),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 28),

                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0369A1),
                        padding:
                            const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _loading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white),
                            )
                          : const Text('Submit Request',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ),
    );
  }
}
