import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../../../services/trade_finance_service.dart';
import '../../../models/error_response.dart';
import '../../../widgets/error_snackbar.dart';

class LCApplyScreen extends StatefulWidget {
  const LCApplyScreen({super.key});

  @override
  State<LCApplyScreen> createState() => _LCApplyScreenState();
}

class _LCApplyScreenState extends State<LCApplyScreen> {
  final _service = TradeFinanceService();
  final _formKey = GlobalKey<FormState>();
  final _beneficiaryController = TextEditingController();
  final _beneficiaryCountryController = TextEditingController();
  final _amountController = TextEditingController();
  final _expiryDateController = TextEditingController();
  final _placeOfExpiryController = TextEditingController();
  final _goodsDescController = TextEditingController();

  String _type = 'irrevocable';
  String _currency = 'USD';
  String _availableBy = 'sight';
  bool _loading = false;

  static const _types = ['irrevocable', 'revocable', 'standby', 'confirmed'];
  static const _currencies = ['USD', 'EUR', 'GBP', 'NGN', 'CNY'];
  static const _availableByOptions = ['sight', 'deferred', 'acceptance', 'negotiation'];

  Future<void> _pickExpiryDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 90)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
    if (picked != null) {
      setState(() {
        _expiryDateController.text =
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
      'available_by': _availableBy,
    };
    if (_beneficiaryCountryController.text.trim().isNotEmpty) {
      data['beneficiary_country'] = _beneficiaryCountryController.text.trim();
    }
    if (_expiryDateController.text.isNotEmpty) {
      data['expiry_date'] = _expiryDateController.text;
    }
    if (_placeOfExpiryController.text.trim().isNotEmpty) {
      data['place_of_expiry'] = _placeOfExpiryController.text.trim();
    }
    if (_goodsDescController.text.trim().isNotEmpty) {
      data['goods_description'] = _goodsDescController.text.trim();
    }

    try {
      final response = await _service.createLC(data);
      if (!mounted) return;
      setState(() => _loading = false);
      if (response.statusCode == 200 || response.statusCode == 201) {
        ErrorSnackbar.showSuccess(context, 'Letter of Credit application submitted!');
        Navigator.pop(context, true);
      } else {
        ErrorSnackbar.show(context, 'Failed to submit LC application');
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
    _beneficiaryCountryController.dispose();
    _amountController.dispose();
    _expiryDateController.dispose();
    _placeOfExpiryController.dispose();
    _goodsDescController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: const Text('Apply for Letter of Credit'),
        ),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),
                  Text('LC Details',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),

                  DropdownButtonFormField<String>(
                    value: _type,
                    decoration:
                        const InputDecoration(labelText: 'LC Type *'),
                    items: _types.map((t) {
                      final label =
                          t[0].toUpperCase() + t.substring(1);
                      return DropdownMenuItem(value: t, child: Text(label));
                    }).toList(),
                    onChanged: (val) =>
                        setState(() => _type = val ?? 'irrevocable'),
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
                  const SizedBox(height: 12),

                  TextFormField(
                    controller: _beneficiaryCountryController,
                    decoration: const InputDecoration(
                        labelText: 'Beneficiary Country (optional)'),
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
                          decoration:
                              const InputDecoration(labelText: 'Amount *'),
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
                          decoration:
                              const InputDecoration(labelText: 'Currency *'),
                          items: _currencies
                              .map((c) => DropdownMenuItem(
                                  value: c, child: Text(c)))
                              .toList(),
                          onChanged: (val) =>
                              setState(() => _currency = val ?? 'USD'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  DropdownButtonFormField<String>(
                    value: _availableBy,
                    decoration:
                        const InputDecoration(labelText: 'Available By *'),
                    items: _availableByOptions.map((o) {
                      final label = o[0].toUpperCase() + o.substring(1);
                      return DropdownMenuItem(value: o, child: Text(label));
                    }).toList(),
                    onChanged: (val) =>
                        setState(() => _availableBy = val ?? 'sight'),
                  ),
                  const SizedBox(height: 12),

                  TextFormField(
                    controller: _expiryDateController,
                    readOnly: true,
                    decoration: InputDecoration(
                      labelText: 'Expiry Date (optional)',
                      suffixIcon: IconButton(
                        icon: const Icon(Icons.calendar_today_outlined),
                        onPressed: _pickExpiryDate,
                      ),
                    ),
                    onTap: _pickExpiryDate,
                  ),
                  const SizedBox(height: 12),

                  TextFormField(
                    controller: _placeOfExpiryController,
                    decoration: const InputDecoration(
                        labelText: 'Place of Expiry (optional)'),
                  ),
                  const SizedBox(height: 20),

                  Text('Goods & Documents',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),

                  TextFormField(
                    controller: _goodsDescController,
                    decoration: const InputDecoration(
                        labelText: 'Goods Description (optional)',
                        alignLabelWithHint: true),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 28),

                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
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
                          : const Text('Submit LC Application',
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
