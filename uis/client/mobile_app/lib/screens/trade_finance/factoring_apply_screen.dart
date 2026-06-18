import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../../../services/trade_finance_service.dart';
import '../../../models/error_response.dart';
import '../../../widgets/error_snackbar.dart';

class FactoringApplyScreen extends StatefulWidget {
  const FactoringApplyScreen({super.key});

  @override
  State<FactoringApplyScreen> createState() => _FactoringApplyScreenState();
}

class _FactoringApplyScreenState extends State<FactoringApplyScreen> {
  final _service = TradeFinanceService();
  final _formKey = GlobalKey<FormState>();
  final _debtorController = TextEditingController();
  final _invoiceTotalController = TextEditingController();
  final _factoringAmountController = TextEditingController();
  final _discountRateController = TextEditingController();

  String _currency = 'NGN';
  bool _loading = false;

  static const _currencies = ['NGN', 'USD', 'EUR', 'GBP'];

  double get _suggestedFactoring {
    final total = double.tryParse(_invoiceTotalController.text) ?? 0;
    return total * 0.8;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    final data = <String, dynamic>{
      'debtor_name': _debtorController.text.trim(),
      'invoice_total': double.parse(_invoiceTotalController.text),
      'factoring_amount': double.parse(_factoringAmountController.text),
      'currency': _currency,
    };
    if (_discountRateController.text.trim().isNotEmpty) {
      data['discount_rate'] =
          double.tryParse(_discountRateController.text.trim()) ?? 0.0;
    }

    try {
      final response = await _service.createFactoringApplication(data);
      if (!mounted) return;
      setState(() => _loading = false);
      if (response.statusCode == 200 || response.statusCode == 201) {
        ErrorSnackbar.showSuccess(context, 'Factoring application submitted!');
        Navigator.pop(context, true);
      } else {
        ErrorSnackbar.show(context, 'Failed to submit factoring application');
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
    _debtorController.dispose();
    _invoiceTotalController.dispose();
    _factoringAmountController.dispose();
    _discountRateController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(title: const Text('Apply for Export Factoring')),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),

                  // Info banner
                  Container(
                    padding: const EdgeInsets.all(14),
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: const Color(0xFF7C3AED).withOpacity(0.06),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: const Color(0xFF7C3AED).withOpacity(0.2)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline_rounded,
                            color: Color(0xFF7C3AED), size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Convert your export invoices into immediate cash. Up to 80% of invoice value.',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey[700],
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  Text('Debtor Information',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),

                  TextFormField(
                    controller: _debtorController,
                    decoration: const InputDecoration(
                        labelText: 'Debtor / Buyer Name *'),
                    validator: (v) =>
                        v == null || v.trim().isEmpty
                            ? 'Enter debtor name'
                            : null,
                  ),
                  const SizedBox(height: 20),

                  Text('Invoice Details',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: TextFormField(
                          controller: _invoiceTotalController,
                          decoration: const InputDecoration(
                              labelText: 'Invoice Total *'),
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          onChanged: (_) {
                            if (_factoringAmountController.text.isEmpty) {
                              setState(() {});
                            }
                          },
                          validator: (v) {
                            if (v == null || v.isEmpty) return 'Enter invoice total';
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
                    controller: _factoringAmountController,
                    decoration: InputDecoration(
                      labelText: 'Factoring Amount *',
                      helperText: _invoiceTotalController.text.isNotEmpty
                          ? 'Suggested: ${_suggestedFactoring.toStringAsFixed(2)} (80%)'
                          : null,
                    ),
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Enter factoring amount';
                      final n = double.tryParse(v);
                      if (n == null || n <= 0) return 'Invalid amount';
                      final total = double.tryParse(
                              _invoiceTotalController.text) ??
                          0;
                      if (total > 0 && n > total) {
                        return 'Cannot exceed invoice total';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),

                  TextFormField(
                    controller: _discountRateController,
                    decoration: const InputDecoration(
                        labelText: 'Discount Rate % (optional)'),
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true),
                  ),
                  const SizedBox(height: 28),

                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF7C3AED),
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
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Submit Application',
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
