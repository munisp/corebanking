import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb, debugPrint;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;
import 'dart:convert';

import '../../../services/api_service.dart';
import '../../../services/lpo_service.dart';

class LPODetailsScreen extends StatefulWidget {
  final String lpoId;

  const LPODetailsScreen({super.key, required this.lpoId});

  @override
  State<LPODetailsScreen> createState() => _LPODetailsScreenState();
}

class _LPODetailsScreenState extends State<LPODetailsScreen> {
  Map<String, dynamic>? _lpoDetails;
  bool _isLoading = true;
  bool _isProcessingPayment = false;
  String? _errorMessage;

  final _pinController = TextEditingController();
  final _amountController = TextEditingController();

  final _apiService = ApiService();
  late final LPOService _lpoService = LPOService(_apiService);

  String? _payerAccountNumber;
  bool _loadingAccount = true;

  @override
  void initState() {
    super.initState();
    _loadUserAccount();
    _loadLPODetails();
  }

  @override
  void dispose() {
    _pinController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  // ================= ACCOUNT =================
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
        _loadingAccount = false;
      });
    } catch (e) {
      setState(() {
        _payerAccountNumber = null;
        _loadingAccount = false;
      });
    }
  }

  // ================= LPO =================
  Future<void> _loadLPODetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final details = await _lpoService.fetchLPODetails(widget.lpoId);
      setState(() {
        _lpoDetails = details;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  // ================= UI =================
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('LPO Details')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!))
              : _buildBody(),
    );
  }

  Widget _buildBody() {
  final d = _lpoDetails!;

  final status = (d['status'] ?? '').toString().toLowerCase();

  final isVerified =
      status == 'verified' || status == 'disbursed';

  final double lpoAmount =
      (d['lpo_amount'] ?? 0).toDouble();

  final double financingAmount =
      (d['financing_amount'] ?? 0).toDouble();

  final double repaymentAmount =
      (d['total_repayment'] ?? financingAmount).toDouble();

  return SingleChildScrollView(
    padding: const EdgeInsets.all(16),
    child: Column(
      children: [
        // ================= TOP CARD =================
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primary,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                d['lpo_number'] ?? 'N/A',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),

              const SizedBox(height: 10),

              Text(
                "Repayment Amount",
                style: TextStyle(
                  color: Colors.white.withOpacity(0.8),
                ),
              ),

              const SizedBox(height: 4),

              Text(
                'NGN ${repaymentAmount.toStringAsFixed(2)}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),

              const SizedBox(height: 8),

              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status.toUpperCase(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // ================= LPO INFO =================
        _buildCard(
          "LPO Information",
          [
            _row("LPO ID", d['lpo_id'] ?? 'N/A'),
            _row("Supplier", d['issuing_organization'] ?? 'N/A'),
            _row("Currency", d['currency'] ?? 'NGN'),
            _row(
              "Repayment Days",
              "${d['repayment_days'] ?? 'N/A'} Days",
            ),
            _row(
              "Due Date",
              d['repayment_due_date'] ?? 'N/A',
            ),
          ],
        ),

        const SizedBox(height: 20),

        // ================= FINANCIAL =================
        _buildCard(
          "Financial Details",
          [
            _row(
              "LPO Amount",
              "NGN ${lpoAmount.toStringAsFixed(2)}",
            ),
            _row(
              "Financed Amount",
              "NGN ${financingAmount.toStringAsFixed(2)}",
            ),
            _row(
              "Interest Rate",
              "${d['interest_rate'] ?? 0}%",
            ),
            _row(
              "Total Repayment",
              "NGN ${repaymentAmount.toStringAsFixed(2)}",
            ),
          ],
        ),

        const SizedBox(height: 30),

        // ================= PAYMENT BUTTON =================
        if (isVerified)
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed:
                  _isProcessingPayment
                      ? null
                      : _showPaymentDialog,
              child: _isProcessingPayment
                  ? const CircularProgressIndicator(
                      color: Colors.white,
                    )
                  : const Text(
                      "Make Repayment",
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
            ),
          ),
      ],
    ),
  );
}

  Widget _buildCard(String title, List<Widget> children) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.bold)),
            const Divider(),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _row(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(k),
          Text(v, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  // ================= PAYMENT DIALOG (FIXED) =================
  void _showPaymentDialog() {
    final formKey = GlobalKey<FormState>();

    _amountController.text =
        (_lpoDetails!['lpo_amount'] ??
                _lpoDetails!['financing_amount'] ??
                0)
            .toString();

    _pinController.clear();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Make Payment"),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ✅ DYNAMIC AMOUNT INPUT
              TextFormField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: "Amount",
                  prefixText: "₦ ",
                  border: OutlineInputBorder(),
                ),
                validator: (v) {
                  final value = double.tryParse(v ?? '');
                  if (value == null || value <= 0) {
                    return "Enter valid amount";
                  }
                  return null;
                },
              ),

              const SizedBox(height: 16),

              TextFormField(
                controller: _pinController,
                obscureText: true,
                maxLength: 4,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: "Enter PIN",
                  border: OutlineInputBorder(),
                  counterText: "",
                ),
                validator: (v) =>
                    (v == null || v.length != 4)
                        ? "Enter 4-digit PIN"
                        : null,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Cancel"),
          ),
          ElevatedButton(
            onPressed: () {
              if (formKey.currentState!.validate()) {
                Navigator.pop(context);
                _processPayment();
              }
            },
            child: const Text("Confirm"),
          ),
        ],
      ),
    );
  }

  // ================= PAYMENT =================
  Future<void> _processPayment() async {
    setState(() => _isProcessingPayment = true);

    try {
      final amount = double.parse(_amountController.text);

      final response = await _apiService.post(
        '/payment-processing/payment/lpo',
        data: {
          "lpo_id": widget.lpoId,
          "payer": _payerAccountNumber, // ✅ ACCOUNT NUMBER
          "amount": amount,             // ✅ DYNAMIC AMOUNT
          "pin": _pinController.text,
        },
      );

      setState(() => _isProcessingPayment = false);

      if (response.statusCode == 200 || response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Payment successful"),
            backgroundColor: Colors.green,
          ),
        );
        _loadLPODetails();
      } else {
        throw Exception("Payment failed");
      }
    } catch (e) {
      setState(() => _isProcessingPayment = false);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error: $e")),
      );
    }
  }
}