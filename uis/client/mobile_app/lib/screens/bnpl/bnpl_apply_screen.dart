import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../../services/bnpl_service.dart';
import '../../services/business_service.dart';
import '../../models/error_response.dart';
import '../../widgets/error_snackbar.dart';

class BNPLApplyScreen extends StatefulWidget {
  const BNPLApplyScreen({super.key});

  @override
  State<BNPLApplyScreen> createState() => _BNPLApplyScreenState();
}

class _BNPLApplyScreenState extends State<BNPLApplyScreen> {
  final _formKey = GlobalKey<FormState>();
  final _purchaseAmountController = TextEditingController();
  final _productDescriptionController = TextEditingController();
  final _creditScoreController = TextEditingController();
  final _businessSearchController = TextEditingController();
  int _installmentCount = 3;
  bool _bvnVerified = false;
  bool _loading = false;

  List<Map<String, dynamic>> _businesses = [];
  List<Map<String, dynamic>> _filteredBusinesses = [];
  Map<String, dynamic>? _selectedBusiness;
  bool _loadingBusinesses = true;
  bool _showBusinessDropdown = false;

  @override
  void initState() {
    super.initState();
    _loadBusinesses();
  }

  Future<void> _loadBusinesses() async {
    final list = await BusinessService().getBusinesses();
    setState(() {
      _businesses = list;
      _filteredBusinesses = list;
      _loadingBusinesses = false;
    });
  }

  void _filterBusinesses(String query) {
    setState(() {
      _filteredBusinesses = _businesses.where((b) {
        final name = (b['name'] ?? '').toString().toLowerCase();
        final reg = (b['registration_number'] ?? '').toString().toLowerCase();
        return name.contains(query.toLowerCase()) || reg.contains(query.toLowerCase());
      }).toList();
    });
  }

  double get _interestRate {
    if (_installmentCount <= 3) return 0.0;
    return 1.5 * (_installmentCount - 3);
  }

  double get _totalAmount {
    final principal = double.tryParse(_purchaseAmountController.text) ?? 0.0;
    return principal * (1 + _interestRate / 100);
  }

  double get _perInstalment => _installmentCount > 0 ? _totalAmount / _installmentCount : 0;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    final service = BNPLService();
    try {
      final data = <String, dynamic>{
        'purchase_amount': double.parse(_purchaseAmountController.text),
        'installment_count': _installmentCount,
        'bvn_verified': _bvnVerified,
      };
      if (_selectedBusiness != null) {
        data['merchant_id'] = _selectedBusiness!['id'];
      }
      if (_productDescriptionController.text.trim().isNotEmpty) {
        data['product_description'] = _productDescriptionController.text.trim();
      }
      if (_creditScoreController.text.trim().isNotEmpty) {
        data['credit_score'] = int.tryParse(_creditScoreController.text.trim()) ?? 0;
      }

      final response = await service.createApplication(data);
      if ((response.statusCode == 200 || response.statusCode == 201) && mounted) {
        ErrorSnackbar.showSuccess(context, 'BNPL application submitted successfully!');
        Navigator.pop(context, true);
      } else if (mounted) {
        ErrorSnackbar.show(context, 'Failed to submit application.');
      }
    } on DioException catch (e) {
      if (mounted) {
        if (e.response?.data != null) {
          try {
            final errorResponse = ErrorResponse.fromJson(e.response!.data);
            ErrorSnackbar.showError(context, errorResponse, showErrorCode: true);
          } catch (_) {
            ErrorSnackbar.show(context, e.message ?? 'Failed to submit application.');
          }
        } else {
          ErrorSnackbar.show(context, e.message ?? 'Network error. Please try again.');
        }
      }
    } catch (e) {
      if (mounted) ErrorSnackbar.show(context, e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _purchaseAmountController.dispose();
    _productDescriptionController.dispose();
    _creditScoreController.dispose();
    _businessSearchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final currencyStr = _purchaseAmountController.text.isNotEmpty
        ? '₦${_totalAmount.toStringAsFixed(2)}'
        : '—';
    final perStr = _purchaseAmountController.text.isNotEmpty
        ? '₦${_perInstalment.toStringAsFixed(2)}'
        : '—';

    return Scaffold(
      appBar: AppBar(title: const Text('Apply for BNPL')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 8),
                Text('Purchase Details', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _purchaseAmountController,
                  decoration: const InputDecoration(
                    labelText: 'Purchase Amount (₦) *',
                    hintText: '0.00',
                  ),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  onChanged: (_) => setState(() {}),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Enter purchase amount';
                    final n = double.tryParse(v);
                    if (n == null || n <= 0) return 'Enter a valid amount';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _productDescriptionController,
                  decoration: const InputDecoration(labelText: 'Product Description (optional)'),
                ),
                const SizedBox(height: 12),
                // Business searchable dropdown
                _BusinessSearchField(
                  controller: _businessSearchController,
                  businesses: _filteredBusinesses,
                  selectedBusiness: _selectedBusiness,
                  loading: _loadingBusinesses,
                  showDropdown: _showBusinessDropdown,
                  onSearch: (q) {
                    _filterBusinesses(q);
                    setState(() => _showBusinessDropdown = true);
                  },
                  onSelect: (b) => setState(() {
                    _selectedBusiness = b;
                    _businessSearchController.clear();
                    _showBusinessDropdown = false;
                  }),
                  onClear: () => setState(() {
                    _selectedBusiness = null;
                    _businessSearchController.clear();
                  }),
                  onToggleDropdown: (v) => setState(() => _showBusinessDropdown = v),
                ),
                const SizedBox(height: 20),
                Text('Repayment Plan', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                DropdownButtonFormField<int>(
                  value: _installmentCount,
                  decoration: const InputDecoration(labelText: 'Number of Instalments *'),
                  items: List.generate(12, (i) => i + 1).map((n) {
                    final rate = n <= 3 ? '0%' : '${(1.5 * (n - 3)).toStringAsFixed(1)}%';
                    return DropdownMenuItem(
                      value: n,
                      child: Text('$n instalment${n > 1 ? 's' : ''} — $rate interest'),
                    );
                  }).toList(),
                  onChanged: (val) => setState(() => _installmentCount = val ?? 3),
                ),
                const SizedBox(height: 12),
                if (_purchaseAmountController.text.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF7C3AED).withOpacity(0.06),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF7C3AED).withOpacity(0.2)),
                    ),
                    child: Column(
                      children: [
                        _SummaryRow(label: 'Total with interest', value: currencyStr),
                        const SizedBox(height: 8),
                        _SummaryRow(label: 'Per instalment', value: perStr),
                        const SizedBox(height: 8),
                        _SummaryRow(
                          label: 'Interest rate',
                          value: '${_interestRate.toStringAsFixed(1)}%',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                Text('Optional Details', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _creditScoreController,
                  decoration: const InputDecoration(labelText: 'Credit Score (optional)'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('BVN Verified'),
                  subtitle: const Text('Confirm your Bank Verification Number is verified'),
                  value: _bvnVerified,
                  onChanged: (val) => setState(() => _bvnVerified = val),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _loading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Submit Application',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
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

class _BusinessSearchField extends StatelessWidget {
  final TextEditingController controller;
  final List<Map<String, dynamic>> businesses;
  final Map<String, dynamic>? selectedBusiness;
  final bool loading;
  final bool showDropdown;
  final ValueChanged<String> onSearch;
  final ValueChanged<Map<String, dynamic>> onSelect;
  final VoidCallback onClear;
  final ValueChanged<bool> onToggleDropdown;

  const _BusinessSearchField({
    required this.controller,
    required this.businesses,
    required this.selectedBusiness,
    required this.loading,
    required this.showDropdown,
    required this.onSearch,
    required this.onSelect,
    required this.onClear,
    required this.onToggleDropdown,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextFormField(
          controller: controller,
          enabled: !loading && selectedBusiness == null,
          onChanged: onSearch,
          onTap: () => onToggleDropdown(true),
          decoration: InputDecoration(
            labelText: selectedBusiness != null
                ? selectedBusiness!['name']?.toString() ?? 'Business selected'
                : 'Merchant Business (optional)',
            hintText: loading ? 'Loading businesses...' : 'Search by name or registration',
            prefixIcon: const Icon(Icons.business),
            suffixIcon: selectedBusiness != null
                ? IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: onClear,
                  )
                : null,
          ),
        ),
        if (selectedBusiness != null)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 12),
            child: Text(
              'Reg: ${selectedBusiness!['registration_number'] ?? ''} · ${selectedBusiness!['verification_status'] ?? ''}',
              style: TextStyle(fontSize: 11, color: Colors.grey[600]),
            ),
          ),
        if (showDropdown && selectedBusiness == null)
          Container(
            constraints: const BoxConstraints(maxHeight: 200),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              border: Border.all(color: Colors.grey.shade300),
              borderRadius: BorderRadius.circular(8),
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 4)],
            ),
            child: businesses.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: Text('No businesses found', style: TextStyle(fontSize: 13)),
                  )
                : ListView.builder(
                    shrinkWrap: true,
                    itemCount: businesses.length,
                    itemBuilder: (context, i) {
                      final b = businesses[i];
                      return InkWell(
                        onTap: () => onSelect(b),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(b['name']?.toString() ?? '',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                              Text('Reg: ${b['registration_number'] ?? ''}',
                                  style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
      ],
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;

  const _SummaryRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(fontSize: 13, color: Colors.grey[700])),
        Text(value,
            style: const TextStyle(
                fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED))),
      ],
    );
  }
}
