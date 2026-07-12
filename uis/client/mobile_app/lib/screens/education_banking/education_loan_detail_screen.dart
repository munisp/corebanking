import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/education_loan_application.dart';
import '../../providers/education_loan_provider.dart';
import '../../providers/tenant_provider.dart';
import '../../services/education_loan_service.dart';
import '../../widgets/error_snackbar.dart';
import '../../../config/app_theme.dart';

class EducationLoanDetailScreen extends StatefulWidget {
  final EducationLoanApplication application;

  const EducationLoanDetailScreen({
    super.key,
    required this.application,
  });

  @override
  State<EducationLoanDetailScreen> createState() =>
      _EducationLoanDetailScreenState();
}

class _EducationLoanDetailScreenState
    extends State<EducationLoanDetailScreen> {
  final EducationLoanService _service = EducationLoanService();

  bool _loading = false;
  bool _loadingSchedule = false;
  String? _feedback;

  List<Map<String, dynamic>> _disbursementSchedule = [];

  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _pinController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadDisbursementSchedule();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  // ================= SCHEDULE =================
  Future<void> _loadDisbursementSchedule() async {
    setState(() => _loadingSchedule = true);

    try {
      final res =
          await _service.getDisbursementSchedule(widget.application.id);

      if (res.statusCode == 200 && res.data != null) {
        final data = res.data;

        if (data is List) {
          _disbursementSchedule = List<Map<String, dynamic>>.from(data);
        } else if (data is Map && data['schedule'] != null) {
          _disbursementSchedule =
              List<Map<String, dynamic>>.from(data['schedule']);
        }

        setState(() {});
      }
    } catch (_) {}

    setState(() => _loadingSchedule = false);
  }

  // ================= STATUS COLOR =================
  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'disbursed':
        return Colors.green;
      case 'pending':
      case 'draft':
        return Colors.orange;
      case 'rejected':
        return Colors.red;
      default:
        return Colors.blueGrey;
    }
  }

  // ================= REPAYMENT MODAL =================
  void _showRepaymentModal() {
    final defaultAmount = widget.application.monthlyPayment > 0
        ? widget.application.monthlyPayment
        : widget.application.amount;

    _amountController.text = defaultAmount.toStringAsFixed(2);
    _pinController.clear();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                "Make Repayment",
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 20),

              // AMOUNT (DYNAMIC)
              TextField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: "Amount",
                  prefixText: "₦",
                  border: OutlineInputBorder(),
                ),
              ),

              const SizedBox(height: 16),

              // PIN
              TextField(
                controller: _pinController,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 4,
                decoration: const InputDecoration(
                  labelText: "PIN",
                  border: OutlineInputBorder(),
                  counterText: "",
                ),
              ),

              const SizedBox(height: 20),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _processRepayment,
                  child: const Text("Pay Now"),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // ================= REPAYMENT =================
  Future<void> _processRepayment() async {
    final amount = double.tryParse(_amountController.text) ?? 0;

    if (amount <= 0 || _pinController.text.length != 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Invalid amount or PIN")),
      );
      return;
    }

    Navigator.pop(context);

    setState(() => _loading = true);

    try {
      final res = await _service.makeRepayment(
        loanId: widget.application.id,
        amount: amount,
        pin: _pinController.text,
      );

      setState(() => _loading = false);

      if (res.statusCode == 200 || res.statusCode == 201) {
        ErrorSnackbar.showSuccess(context, "Payment successful");
        _loadDisbursementSchedule();
      } else {
        ErrorSnackbar.showError(context, "Payment failed");
      }
    } catch (e) {
      setState(() => _loading = false);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }

  // ================= UI =================
  @override
  Widget build(BuildContext context) {
    final app = widget.application;
    final statusColor = _statusColor(app.status);

    final isInstitutionVerified =
        app.institution.verificationStatus.toLowerCase() == "verified";

    final canRepay = isInstitutionVerified ||
        (app.status.toLowerCase() == "institution_verified" ||
            app.status.toLowerCase() == "disbursed");

    return Scaffold(
      appBar: AppBar(title: const Text("Education Loan Details")),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [

            // ================= HEADER =================
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
                  Text(app.applicantName,
                      style: const TextStyle(color: Colors.white)),
                  const SizedBox(height: 10),
                  Text(
                    "₦${app.amount.toStringAsFixed(2)}",
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.bold),
                  ),
                  Text(app.status.toUpperCase(),
                      style: const TextStyle(color: Colors.white70)),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // ================= DETAILS (UNCHANGED CORE STRUCTURE) =================
            _section("Student Info", [
              _row("Name", app.applicantName),
              _row("Email", app.studentEmail),
              _row("Phone", app.studentPhone),
            ]),

            _section("Institution", [
              _row("Name", app.institution.name),
              _row("Status", app.status),
            ]),

            _section("Financial", [
              _row("Amount", "₦${app.amount}"),
              _row("Outstanding", "₦${app.outstandingBalance}"),
            ]),

            const SizedBox(height: 20),

            // ================= REPAY BUTTON =================
            if (canRepay)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.payment),
                  onPressed: _showRepaymentModal,
                  label: const Text("Make Repayment"),
                ),
              ),

            const SizedBox(height: 20),

            // ================= SCHEDULE =================
            if (_loadingSchedule)
              const CircularProgressIndicator(),

            ..._disbursementSchedule.map((e) => ListTile(
                  title: Text("₦${e['amount']}"),
                  subtitle: Text(e['status'] ?? ''),
                )),
          ],
        ),
      ),
    );
  }

  // ================= HELPERS =================
  Widget _section(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style:
                const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 10),
        ...children,
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _row(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(k),
          Text(v, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}