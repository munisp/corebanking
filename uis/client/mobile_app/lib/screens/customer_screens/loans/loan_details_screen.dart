import 'dart:convert';
import 'dart:math' show pow;
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb, debugPrint;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;

import '../../../services/api_service.dart';
import '../../../services/loan_service.dart';
import '../../../services/payment_service.dart';

class LoanApplicationDetailsScreen extends StatefulWidget {
  const LoanApplicationDetailsScreen({super.key});

  @override
  State<LoanApplicationDetailsScreen> createState() =>
      _LoanApplicationDetailsScreenState();
}

class _LoanApplicationDetailsScreenState
    extends State<LoanApplicationDetailsScreen> {
  final LoanService _loanService = LoanService(ApiService());
  final PaymentService _paymentService = PaymentService(ApiService());

  Map<String, dynamic>? _loanDetails;

  bool _isLoading = true;
  bool _isProcessingPayment = false;

  String? _errorMessage;
  String? _loanId;
  String? _payerAccountNumber;

  final _formKey = GlobalKey<FormState>();

  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _pinController = TextEditingController();

  final NumberFormat currencyFormat =
      NumberFormat.currency(locale: 'en_NG', symbol: '₦');

  // ================= SAFE CONVERTER =================
  double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0.0;
  }

  int _toInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    return int.tryParse(value.toString()) ?? 0;
  }

  String formatMoney(dynamic value) {
    return currencyFormat.format(_toDouble(value));
  }

  String formatDate(dynamic date) {
    if (date == null) return "-";

    try {
      return DateFormat(
        'dd MMM yyyy • hh:mm a',
      ).format(DateTime.parse(date.toString()).toLocal());
    } catch (_) {
      return date.toString();
    }
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
        return Colors.blue;

      case 'disbursed':
        return Colors.green;

      case 'pending':
        return Colors.orange;

      case 'rejected':
        return Colors.red;

      case 'active':
        return Colors.teal;

      default:
        return Colors.grey;
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;

    _loanId = args?['loanId']?.toString();

    if (_loanId != null && _loanId!.isNotEmpty) {
      _loadLoanDetails();
      _loadUserAccount();
    } else {
      setState(() {
        _errorMessage = 'No loan ID provided';
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  // ================= LOAD ACCOUNT =================
  Future<void> _loadUserAccount() async {
    try {
      String? accountNumber;

      if (kIsWeb) {
        final accountJson = html.window.localStorage['account'];

        if (accountJson != null) {
          final data = jsonDecode(accountJson);
          accountNumber = data['account_number']?.toString();
        }
      } else {
        final prefs = await SharedPreferences.getInstance();

        final accountJson = prefs.getString('account');

        if (accountJson != null) {
          final data = jsonDecode(accountJson);
          accountNumber = data['account_number']?.toString();
        }
      }

      setState(() {
        _payerAccountNumber = accountNumber;
      });
    } catch (e) {
      debugPrint("Account load error: $e");
    }
  }

  // ================= LOAD LOAN =================
  Future<void> _loadLoanDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final raw = await _loanService.fetchLoanDetails(_loanId!);

      setState(() {
        _loanDetails = raw;
        _isLoading = false;

        _amountController.text = monthlyPayment.toStringAsFixed(2);
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  // ================= MONTHLY PAYMENT =================
  double get monthlyPayment {
    final amount = _toDouble(_loanDetails?['loan_amount']);
    final rate = _toDouble(_loanDetails?['interest_rate_percent']);
    final term = _toDouble(_loanDetails?['requested_term']);

    if (term <= 0) return 0;

    final r = rate / 100 / 12;

    if (r == 0) return amount / term;

    return (amount * r * pow(1 + r, term)) /
        (pow(1 + r, term) - 1);
  }

  double get totalPaid {
    final payments = (_loanDetails?['payments'] as List?) ?? [];

    return payments.fold<double>(
      0,
      (sum, item) => sum + _toDouble(item['amount']),
    );
  }

  double get remainingBalance {
    return _toDouble(_loanDetails?['loan_amount']) - totalPaid;
  }

  // ================= PAYMENT MODAL =================
  Future<void> _showLoanPaymentModal() async {
    _amountController.text = monthlyPayment.toStringAsFixed(2);
    _pinController.clear();

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 60,
                  height: 5,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(20),
                  ),
                ),

                const SizedBox(height: 20),

                const Text(
                  "Loan Repayment",
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),

                const SizedBox(height: 8),

                Text(
                  "Recommended monthly repayment",
                  style: TextStyle(
                    color: Colors.grey.shade600,
                  ),
                ),

                const SizedBox(height: 6),

                Text(
                  formatMoney(monthlyPayment),
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                  ),
                ),

                const SizedBox(height: 24),

                TextFormField(
                  controller: _amountController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: "Amount",
                    prefixText: "₦ ",
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) =>
                      (v == null || v.isEmpty) ? "Enter amount" : null,
                ),

                const SizedBox(height: 16),

                TextFormField(
                  controller: _pinController,
                  keyboardType: TextInputType.number,
                  obscureText: true,
                  maxLength: 4,
                  decoration: const InputDecoration(
                    labelText: "Transaction PIN",
                    border: OutlineInputBorder(),
                    counterText: "",
                  ),
                  validator: (v) =>
                      (v == null || v.length != 4)
                          ? "Enter 4-digit PIN"
                          : null,
                ),

                const SizedBox(height: 24),

                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: () {
                      if (_formKey.currentState!.validate()) {
                        Navigator.pop(context, true);
                      }
                    },
                    child: const Text("Proceed Payment"),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (confirmed == true) {
      await _processRepayment();
    }
  }

  // ================= PAYMENT =================
  Future<void> _processRepayment() async {
    setState(() => _isProcessingPayment = true);

    try {
      final amount = double.parse(_amountController.text);

      final result = await _paymentService.loanPayment(
        loanId: _loanId!,
        customerAccountNumber: _payerAccountNumber ?? '',
        amount: amount,
        pin: _pinController.text,
      );

      setState(() => _isProcessingPayment = false);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Done'),
          backgroundColor:
              result['success'] == true ? Colors.green : Colors.red,
        ),
      );

      if (result['success'] == true) {
        _loadLoanDetails();
      }
    } catch (e) {
      setState(() => _isProcessingPayment = false);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  // ================= UI =================
  @override
  Widget build(BuildContext context) {
    final status = (_loanDetails?['status'] ?? '').toString();

    final payments = (_loanDetails?['payments'] as List?) ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text("Loan Details"),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!))
              : RefreshIndicator(
                  onRefresh: _loadLoanDetails,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        // ================= HEADER CARD =================
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Theme.of(context).colorScheme.primary,
                                Theme.of(context).colorScheme.secondary,
                              ],
                            ),
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: _statusColor(status),
                                  borderRadius: BorderRadius.circular(50),
                                ),
                                child: Text(
                                  status.toUpperCase(),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),

                              const SizedBox(height: 20),

                              Text(
                                formatMoney(
                                  _loanDetails?['loan_amount'],
                                ),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 34,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),

                              const SizedBox(height: 8),

                              Text(
                                _loanDetails?['loan_purpose'] ?? '-',
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 16,
                                ),
                              ),

                              const SizedBox(height: 20),

                              Row(
                                children: [
                                  Expanded(
                                    child: _headerMetric(
                                      "Monthly Payment",
                                      formatMoney(monthlyPayment),
                                    ),
                                  ),
                                  Expanded(
                                    child: _headerMetric(
                                      "Remaining",
                                      formatMoney(remainingBalance),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 20),

                        // ================= LOAN INFO =================
                        _section(
                          "Loan Information",
                          [
                            _row(
                              "Loan ID",
                              _loanDetails?['loan_application_id'] ?? '-',
                            ),
                            _row(
                              "Interest Rate",
                              "${_toDouble(_loanDetails?['interest_rate_percent']).toStringAsFixed(2)}%",
                            ),
                            _row(
                              "Term",
                              "${_toInt(_loanDetails?['requested_term'])} months",
                            ),
                            _row(
                              "Loan Type",
                              (_loanDetails?['loan_type'] ?? '')
                                      .toString()
                                      .isEmpty
                                  ? "-"
                                  : _loanDetails?['loan_type'],
                            ),
                            _row(
                              "Started Date",
                              formatDate(
                                _loanDetails?['loan_started_at'],
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 20),

                        // ================= APPLICANT PROFILE =================
                        _section(
                          "Applicant Profile",
                          [
                            _row(
                              "Employment",
                              _loanDetails?['employment_status'] ?? '-',
                            ),
                            _row(
                              "Employment Duration",
                              "${_toInt(_loanDetails?['employment_duration'])} months",
                            ),
                            _row(
                              "Monthly Income",
                              formatMoney(
                                _loanDetails?['monthly_income'],
                              ),
                            ),
                            _row(
                              "Existing Debt",
                              formatMoney(
                                _loanDetails?['existing_debt'],
                              ),
                            ),
                            _row(
                              "Collateral Value",
                              formatMoney(
                                _loanDetails?['collateral_value'],
                              ),
                            ),
                            _row(
                              "Credit Score",
                              "${_toInt(_loanDetails?['credit_score'])}",
                            ),
                            _row(
                              "Bank Statement Score",
                              "${_toInt(_loanDetails?['bank_statement_score'])}",
                            ),
                          ],
                        ),

                        const SizedBox(height: 20),

                        // ================= VERIFICATION =================
                        _section(
                          "Verification",
                          [
                            _statusRow(
                              "BVN Verified",
                              _loanDetails?['bvn_verified'] == true,
                            ),
                            _statusRow(
                              "NIN Verified",
                              _loanDetails?['nin_verified'] == true,
                            ),
                          ],
                        ),

                        const SizedBox(height: 20),

                        // ================= PAYMENT HISTORY =================
                        _section(
                          "Payment History",
                          [
                            if (payments.isEmpty)
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 20),
                                child: Center(
                                  child: Text(
                                    "No repayments yet",
                                    style: TextStyle(
                                      color: Colors.grey.shade600,
                                    ),
                                  ),
                                ),
                              ),

                            ...payments.map((payment) {
                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: Colors.grey.shade200,
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                      backgroundColor:
                                          Colors.green.withOpacity(.1),
                                      child: const Icon(
                                        Icons.payments_outlined,
                                        color: Colors.green,
                                      ),
                                    ),

                                    const SizedBox(width: 14),

                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            formatMoney(payment['amount']),
                                            style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 16,
                                            ),
                                          ),

                                          const SizedBox(height: 4),

                                          Text(
                                            payment['payment_method'] ?? '-',
                                            style: TextStyle(
                                              color: Colors.grey.shade700,
                                            ),
                                          ),

                                          const SizedBox(height: 2),

                                          Text(
                                            formatDate(
                                              payment['payment_date'],
                                            ),
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.grey.shade600,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }),
                          ],
                        ),

                        const SizedBox(height: 30),

                        // ================= PAYMENT BUTTON =================
                        if ([
                          'active',
                          'disbursed',
                          'approved',
                        ].contains(status.toLowerCase()))
                          SizedBox(
                            width: double.infinity,
                            height: 55,
                            child: ElevatedButton.icon(
                              onPressed: _isProcessingPayment
                                  ? null
                                  : _showLoanPaymentModal,
                              icon: _isProcessingPayment
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        color: Colors.white,
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.payment),
                              label: Text(
                                _isProcessingPayment
                                    ? "Processing..."
                                    : "Make Repayment",
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
    );
  }

  // ================= WIDGETS =================

  Widget _headerMetric(String title, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 12,
          ),
        ),

        const SizedBox(height: 4),

        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
      ],
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: Colors.grey.shade200,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 17,
            ),
          ),

          const SizedBox(height: 16),

          ...children,
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: Colors.grey.shade700,
              ),
            ),
          ),

          const SizedBox(width: 12),

          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusRow(String label, bool verified) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        children: [
          Expanded(child: Text(label)),

          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: 10,
              vertical: 5,
            ),
            decoration: BoxDecoration(
              color: verified
                  ? Colors.green.withOpacity(.1)
                  : Colors.red.withOpacity(.1),
              borderRadius: BorderRadius.circular(30),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  verified ? Icons.check_circle : Icons.cancel,
                  size: 16,
                  color: verified ? Colors.green : Colors.red,
                ),

                const SizedBox(width: 5),

                Text(
                  verified ? "Verified" : "Not Verified",
                  style: TextStyle(
                    color: verified ? Colors.green : Colors.red,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}