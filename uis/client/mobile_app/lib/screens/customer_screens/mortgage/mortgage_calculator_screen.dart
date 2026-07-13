import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'dart:math' as math;
import '../../../config/app_theme.dart';
import '../../../l10n/app_localizations.dart';

class MortgageCalculatorScreen extends StatefulWidget {
  const MortgageCalculatorScreen({super.key});

  @override
  State<MortgageCalculatorScreen> createState() =>
      _MortgageCalculatorScreenState();
}

class _MortgageCalculatorScreenState extends State<MortgageCalculatorScreen> {
  final _propertyValueController = TextEditingController();
  final _downPaymentController = TextEditingController();
  final _interestRateController = TextEditingController(text: '12.5');
  
  int _loanTerm = 20;
  double? _monthlyPayment;
  double? _totalPayment;
  double? _totalInterest;
  double? _loanAmount;

  @override
  void dispose() {
    _propertyValueController.dispose();
    _downPaymentController.dispose();
    _interestRateController.dispose();
    super.dispose();
  }

  void _calculateMortgage() {
    final propertyValue = double.tryParse(
      _propertyValueController.text.replaceAll(',', ''),
    );
    final downPayment = double.tryParse(
      _downPaymentController.text.replaceAll(',', ''),
    );
    final interestRate = double.tryParse(_interestRateController.text);

    if (propertyValue == null || downPayment == null || interestRate == null) {
      return;
    }

    if (downPayment >= propertyValue) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Down payment must be less than property value'),
          backgroundColor: AppTheme.errorColor,
        ),
      );
      return;
    }

    final principal = propertyValue - downPayment;
    final monthlyRate = (interestRate / 100) / 12;
    final numberOfPayments = _loanTerm * 12;

    final monthlyPayment = principal *
        (monthlyRate * math.pow(1 + monthlyRate, numberOfPayments)) /
        (math.pow(1 + monthlyRate, numberOfPayments) - 1);

    setState(() {
      _loanAmount = principal;
      _monthlyPayment = monthlyPayment;
      _totalPayment = monthlyPayment * numberOfPayments;
      _totalInterest = _totalPayment! - principal;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.mortgageCalculator),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Property Value
            _buildLabel(l10n.propertyValue),
            const SizedBox(height: 8),
            TextField(
              controller: _propertyValueController,
              decoration: InputDecoration(
                hintText: '45000000',
                prefixIcon: const Icon(Icons.home_outlined),
                prefixText: '₦ ',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 20),

            // Down Payment
            _buildLabel(l10n.downPayment),
            const SizedBox(height: 8),
            TextField(
              controller: _downPaymentController,
              decoration: InputDecoration(
                hintText: '9000000',
                prefixIcon: const Icon(Icons.account_balance_wallet_outlined),
                prefixText: '₦ ',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 20),

            // Interest Rate
            _buildLabel(l10n.interestRate),
            const SizedBox(height: 8),
            TextField(
              controller: _interestRateController,
              decoration: InputDecoration(
                hintText: '12.5',
                prefixIcon: const Icon(Icons.percent_outlined),
                suffixText: '%',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 20),

            // Loan Term
            _buildLabel('${l10n.loanTerm} ($_loanTerm years)'),
            const SizedBox(height: 8),
            Slider(
              value: _loanTerm.toDouble(),
              min: 5,
              max: 30,
              divisions: 25,
              label: '$_loanTerm years',
              onChanged: (value) {
                setState(() => _loanTerm = value.toInt());
              },
            ),
            const SizedBox(height: 24),

            // Calculate Button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _calculateMortgage,
                icon: const Icon(Icons.calculate),
                label: Text(l10n.calculatePayment),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),

            // Results
            if (_monthlyPayment != null) ...[
              const SizedBox(height: 32),
              Text(
                'Results',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.getTextPrimary(context),
                ),
              ),
              const SizedBox(height: 16),

              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: AppTheme.getBorderColor(context)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      _buildResultRow(
                        'Loan Amount',
                        currencyFormat.format(_loanAmount),
                        AppTheme.primaryColor,
                      ),
                      const Divider(height: 24),
                      _buildResultRow(
                        l10n.monthlyPayment,
                        currencyFormat.format(_monthlyPayment),
                        AppTheme.successColor,
                        isHighlight: true,
                      ),
                      const Divider(height: 24),
                      _buildResultRow(
                        l10n.totalAmount,
                        currencyFormat.format(_totalPayment),
                        AppTheme.getTextPrimary(context),
                      ),
                      const Divider(height: 24),
                      _buildResultRow(
                        l10n.totalInterest,
                        currencyFormat.format(_totalInterest),
                        AppTheme.warningColor,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Breakdown Card
              Card(
                elevation: 0,
                color: AppTheme.primaryColor.withOpacity(0.05),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.info_outline,
                            size: 20,
                            color: AppTheme.primaryColor,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Breakdown',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.primaryColor,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        '• Total payments over $_loanTerm years: ${_loanTerm * 12} months',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppTheme.getTextPrimary(context),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '• Interest rate: ${_interestRateController.text}% per annum',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppTheme.getTextPrimary(context),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '• Down payment: ${((double.parse(_downPaymentController.text.replaceAll(',', '')) / double.parse(_propertyValueController.text.replaceAll(',', ''))) * 100).toStringAsFixed(1)}% of property value',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppTheme.getTextPrimary(context),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: AppTheme.getTextPrimary(context),
      ),
    );
  }

  Widget _buildResultRow(String label, String value, Color color,
      {bool isHighlight = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: isHighlight ? 16 : 14,
            fontWeight: isHighlight ? FontWeight.w600 : FontWeight.w500,
            color: AppTheme.getTextSecondary(context),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: isHighlight ? 20 : 16,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ],
    );
  }
}
