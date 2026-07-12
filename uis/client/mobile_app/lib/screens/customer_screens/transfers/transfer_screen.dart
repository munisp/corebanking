import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart' show kIsWeb, debugPrint;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;
import 'package:provider/provider.dart';
import 'dart:convert';
import '../../../l10n/app_localizations.dart';
import '../../../config/app_theme.dart';
import '../../../services/payment_service.dart';
import '../../../services/api_service.dart';
import '../../../providers/tenant_provider.dart';

class TransferScreen extends StatefulWidget {
  const TransferScreen({super.key});

  @override
  State<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends State<TransferScreen> {
  final _formKey = GlobalKey<FormState>();
  final _payeeAccountIdController = TextEditingController();
  final _amountController = TextEditingController();
  final _noteController = TextEditingController();
  final _pinController = TextEditingController();
  final _paymentService = PaymentService(ApiService());

  bool _isProcessing = false;
  String? _payerAccountNumber; // Loaded from storage
  bool _isLoadingAccountNumber = true;

  // Bank selection
  List<Map<String, dynamic>> _banks = [];
  String? _selectedBank;
  bool _isLoadingBanks = false;

  // Account validation
  bool _isVerifyingAccount = false;
  String? _validatedAccountName;
  bool _accountValidated = false;

  @override
  void initState() {
    super.initState();
    _loadUserAccount();
    _loadBanks();
  }

  /// Load account_number from account.account_number in localStorage/SharedPreferences
  /// Updated to use account_number instead of account id
  Future<void> _loadUserAccount() async {
    try {
      String? accountNumber;

      if (kIsWeb) {
        // Get account object from localStorage
        final accountJson = html.window.localStorage['account'];
        if (accountJson != null && accountJson.isNotEmpty) {
          try {
            final accountData = jsonDecode(accountJson);
            accountNumber = accountData['account_number']?.toString();
            debugPrint('[Transfer] Web - Got account_number: $accountNumber');
          } catch (e) {
            debugPrint('[Transfer] Web - Failed to parse account JSON: $e');
          }
        } else {
          debugPrint('[Transfer] Web - No account found in localStorage');
        }
      } else {
        // Get account object from SharedPreferences
        final prefs = await SharedPreferences.getInstance();
        final accountJson = prefs.getString('account');
        if (accountJson != null && accountJson.isNotEmpty) {
          try {
            final accountData = jsonDecode(accountJson);
            accountNumber = accountData['account_number']?.toString();
            debugPrint(
                '[Transfer] Mobile - Got account_number: $accountNumber');
          } catch (e) {
            debugPrint('[Transfer] Mobile - Failed to parse account JSON: $e');
          }
        } else {
          debugPrint(
              '[Transfer] Mobile - No account found in SharedPreferences');
        }
      }

      setState(() {
        _payerAccountNumber = accountNumber;
        _isLoadingAccountNumber = false;
      });

      if (accountNumber == null) {
        debugPrint('[Transfer] ⚠️ WARNING: No account_number found in storage');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                  'Unable to load your account. Please try logging in again.'),
              backgroundColor: AppTheme.errorColor,
            ),
          );
        }
      } else {
        debugPrint(
            '[Transfer] ✓ Successfully loaded account_number: $accountNumber');
      }
    } catch (e) {
      debugPrint('[Transfer] ❌ ERROR loading account_number: $e');
      setState(() {
        _payerAccountNumber = null;
        _isLoadingAccountNumber = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error loading account: ${e.toString()}'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    }
  }

  // Load banks for transfer
  Future<void> _loadBanks() async {
    setState(() {
      _isLoadingBanks = true;
    });

    try {
      final banks = await _paymentService.getBanks();
      setState(() {
        _banks = banks;
        _isLoadingBanks = false;
      });
      debugPrint('[Transfer] ✓ Loaded ${banks.length} banks');
    } catch (e) {
      debugPrint('[Transfer] ❌ Failed to load banks: $e');
      setState(() {
        _isLoadingBanks = false;
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to load banks: ${e.toString()}'),
          backgroundColor: AppTheme.errorColor,
        ),
      );
    }
  }

  // Validate payee account number
  Future<void> _validateAccount() async {
    final accountNumber = _payeeAccountIdController.text.trim();

    if (accountNumber.isEmpty) {
      return;
    }

    if (accountNumber.length < 10) {
      setState(() {
        _validatedAccountName = null;
        _accountValidated = false;
      });
      return;
    }

    setState(() {
      _isVerifyingAccount = true;
      _validatedAccountName = null;
      _accountValidated = false;
    });

    try {
      debugPrint('[Transfer] Validating account number: $accountNumber');
      final result = await _paymentService.validateAccountNumber(accountNumber);

      if (result['success'] == true) {
        setState(() {
          _validatedAccountName = result['accountName'];
          _accountValidated = true;
          _isVerifyingAccount = false;
        });
        debugPrint('[Transfer] ✓ Account validated: ${result['accountName']}');

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Account verified: ${result['accountName']}'),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 2),
            ),
          );
        }
      } else {
        setState(() {
          _validatedAccountName = null;
          _accountValidated = false;
          _isVerifyingAccount = false;
        });
        debugPrint(
            '[Transfer] ❌ Account validation failed: ${result['message']}');

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? 'Account not found'),
              backgroundColor: AppTheme.errorColor,
            ),
          );
        }
      }
    } catch (e) {
      setState(() {
        _validatedAccountName = null;
        _accountValidated = false;
        _isVerifyingAccount = false;
      });
      debugPrint('[Transfer] ❌ Account validation error: $e');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Verification failed: ${e.toString()}'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    }
  }

  Future<void> _processTransfer() async {
    if (!_formKey.currentState!.validate()) return;

    if (_payerAccountNumber == null || _payeeAccountIdController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_payerAccountNumber == null
              ? 'Unable to load your account. Please try again.'
              : 'Please enter payee account number'),
          backgroundColor: AppTheme.errorColor,
        ),
      );
      return;
    }

    // Show confirmation dialog
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Theme.of(context).cardColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Confirm Transfer',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: AppTheme.primaryColor,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildConfirmationRow('Amount', '₦${_amountController.text}'),
            const Divider(),
            _buildConfirmationRow('From Account', _payerAccountNumber ?? 'N/A'),
            const Divider(),
            _buildConfirmationRow('To Account', _payeeAccountIdController.text),
            if (_validatedAccountName != null) ...[
              const Divider(),
              _buildConfirmationRow('Account Name', _validatedAccountName!),
            ],
            if (_selectedBank != null) ...[
              const Divider(),
              _buildConfirmationRow(
                  'Bank',
                  _banks.firstWhere((b) => b['code'] == _selectedBank,
                          orElse: () => {'name': _selectedBank})['name'] ??
                      _selectedBank ??
                      'N/A'),
            ],
            const Divider(),
            _buildConfirmationRow('Note',
                _noteController.text.isEmpty ? 'N/A' : _noteController.text),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() {
      _isProcessing = true;
    });

    try {
      debugPrint(
          '[Transfer] Processing transfer from account_number: $_payerAccountNumber to: ${_payeeAccountIdController.text}');

      // Updated to use account_number instead of account_id
      final result = await _paymentService.transfer(
        payerAccountNumber: _payerAccountNumber ?? '',
        payeeAccountNumber: _payeeAccountIdController.text,
        amount: double.parse(_amountController.text),
        note: _noteController.text.isEmpty ? 'Transfer' : _noteController.text,
        pin: _pinController.text,
        bank: _selectedBank,
      );

      setState(() {
        _isProcessing = false;
      });

      if (!mounted) return;

      if (result['success'] == true) {
        // Get transaction ID from API response - it's directly in result['data']
        await Future.delayed(const Duration(seconds: 3), () {
          // Code to be executed after the delay
          print("Delayed code executed after 3 seconds");
        });
        setState(() {
          _isProcessing = false;
        });
        final transactionId = result['data']?['reference']?.toString() ??
            'TXN${DateTime.now().millisecondsSinceEpoch.toString().substring(3)}';

        debugPrint('[Transfer] Transaction ID: $transactionId');

        // Show receipt screen with transaction ID
        await Navigator.pushNamed(
          context,
          '/transfer-receipt',
          arguments: transactionId,
        );

        // Navigate back to dashboard
        if (mounted) Navigator.pop(context);
      } else {
        setState(() {
          _isProcessing = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? 'Transfer failed'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isProcessing = false;
      });

      if (!mounted) return;

      debugPrint('[Transfer] ❌ Transfer error: $e');

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              'Transfer failed: ${e.toString().replaceAll('Exception: ', '')}'),
          backgroundColor: AppTheme.errorColor,
        ),
      );
    }
  }

  Widget _buildConfirmationRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: AppTheme.getTextSecondary(context),
              fontSize: 14,
            ),
          ),
          Flexible(
            child: Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(l10n.transferMoney),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_outlined),
            tooltip: l10n.savedBeneficiaries,
            onPressed: () {
              Navigator.pushNamed(context, '/beneficiaries');
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 4),

                // Premium Header Card with Gradient
                Consumer<TenantProvider>(
                  builder: (context, tenantProvider, _) {
                    return Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            tenantProvider.primaryColor,
                            tenantProvider.primaryColor.withOpacity(0.8),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: tenantProvider.primaryColor.withOpacity(0.3),
                            blurRadius: 12,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: Colors.white.withOpacity(0.3),
                                width: 1,
                              ),
                            ),
                            child: const Icon(
                              Icons.send_rounded,
                              color: Colors.white,
                              size: 32,
                            ),
                          ),
                          const SizedBox(width: 18),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Send Money',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 22,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                                SizedBox(height: 6),
                                Text(
                                  'Transfer to any bank account',
                                  style: TextStyle(
                                    color: Colors.white70,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w400,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
                const SizedBox(height: 28),

                // Premium Form Fields Container
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppTheme.getCardBackground(context),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: AppTheme.getBorderColor(context),
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.04),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // From Account (Premium Design)
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: _isLoadingAccountNumber
                              ? theme.colorScheme.surfaceContainerHighest
                                  .withOpacity(0.3)
                              : (_payerAccountNumber != null
                                  ? theme.colorScheme.primary.withOpacity(0.08)
                                  : theme.colorScheme.error.withOpacity(0.08)),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: _isLoadingAccountNumber
                                ? theme.colorScheme.outline.withOpacity(0.2)
                                : (_payerAccountNumber != null
                                    ? theme.colorScheme.primary.withOpacity(0.2)
                                    : theme.colorScheme.error.withOpacity(0.2)),
                            width: 1.5,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: _isLoadingAccountNumber
                                    ? theme.colorScheme.surfaceContainerHighest
                                    : (_payerAccountNumber != null
                                        ? theme.colorScheme.primary
                                            .withOpacity(0.15)
                                        : theme.colorScheme.error
                                            .withOpacity(0.15)),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                _isLoadingAccountNumber
                                    ? Icons.hourglass_empty_rounded
                                    : Icons.account_balance_wallet_rounded,
                                color: _isLoadingAccountNumber
                                    ? theme.colorScheme.onSurface
                                        .withOpacity(0.5)
                                    : (_payerAccountNumber != null
                                        ? theme.colorScheme.primary
                                        : theme.colorScheme.error),
                                size: 24,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    l10n.fromAccountId,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      color: AppTheme.getTextSecondary(context),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _isLoadingAccountNumber
                                        ? 'Loading...'
                                        : (_payerAccountNumber ??
                                            'Not available'),
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      color: _isLoadingAccountNumber
                                          ? AppTheme.getTextSecondary(context)
                                          : (_payerAccountNumber != null
                                              ? AppTheme.getTextPrimary(context)
                                              : theme.colorScheme.error),
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 20),

                      // Payee Account Number (Premium Input with Validation)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          TextFormField(
                            controller: _payeeAccountIdController,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly
                            ],
                            onChanged: (value) {
                              // Clear validation when user changes input
                              if (_accountValidated &&
                                  value.length !=
                                      _payeeAccountIdController.text.length) {
                                setState(() {
                                  _validatedAccountName = null;
                                  _accountValidated = false;
                                });
                              }
                            },
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.getTextPrimary(context),
                            ),
                            decoration: InputDecoration(
                              labelText: l10n.payeeAccountId,
                              hintText: l10n.enterPayeeAccountId,
                              prefixIcon: Container(
                                margin: const EdgeInsets.all(12),
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: theme.colorScheme.primary
                                      .withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Icon(
                                  Icons.person_outline_rounded,
                                  color: theme.colorScheme.primary,
                                  size: 20,
                                ),
                              ),
                              suffixIcon: _payeeAccountIdController
                                          .text.length >=
                                      10
                                  ? IconButton(
                                      icon: _isVerifyingAccount
                                          ? SizedBox(
                                              height: 20,
                                              width: 20,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2,
                                                valueColor:
                                                    AlwaysStoppedAnimation<
                                                        Color>(
                                                  theme.colorScheme.primary,
                                                ),
                                              ),
                                            )
                                          : Icon(
                                              _accountValidated
                                                  ? Icons.check_circle
                                                  : Icons.search,
                                              color: _accountValidated
                                                  ? Colors.green
                                                  : theme.colorScheme.primary,
                                            ),
                                      onPressed: _isVerifyingAccount
                                          ? null
                                          : _validateAccount,
                                      tooltip: 'Verify Account',
                                    )
                                  : null,
                              filled: true,
                              fillColor: AppTheme.getCardBackground(context),
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 18),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(
                                  color: _accountValidated
                                      ? Colors.green
                                      : AppTheme.getBorderColor(context),
                                  width: 1.5,
                                ),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(
                                  color: _accountValidated
                                      ? Colors.green
                                      : AppTheme.getBorderColor(context),
                                  width: 1.5,
                                ),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(
                                  color: _accountValidated
                                      ? Colors.green
                                      : theme.colorScheme.primary,
                                  width: 2,
                                ),
                              ),
                              errorBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(
                                  color: theme.colorScheme.error,
                                  width: 1.5,
                                ),
                              ),
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return l10n.pleaseEnterPayeeAccountId;
                              }
                              return null;
                            },
                          ),

                          // Display validated account name
                          if (_validatedAccountName != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 8, left: 16),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.check_circle,
                                    size: 16,
                                    color: Colors.green,
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      _validatedAccountName!,
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.green,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),

                      const SizedBox(height: 20),

                      // Bank Selection (Premium Dropdown)
                      DropdownButtonFormField<String>(
                        initialValue: _selectedBank,
                        decoration: InputDecoration(
                          labelText: 'Recipient Bank',
                          hintText: 'Select bank',
                          prefixIcon: Container(
                            margin: const EdgeInsets.all(12),
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: theme.colorScheme.primary.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              Icons.account_balance_rounded,
                              color: theme.colorScheme.primary,
                              size: 20,
                            ),
                          ),
                          filled: true,
                          fillColor: AppTheme.getCardBackground(context),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 18),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: AppTheme.getBorderColor(context),
                              width: 1.5,
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: AppTheme.getBorderColor(context),
                              width: 1.5,
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: theme.colorScheme.primary,
                              width: 2,
                            ),
                          ),
                        ),
                        items: _isLoadingBanks
                            ? []
                            : _banks.map((bank) {
                                return DropdownMenuItem<String>(
                                  value: bank['code']?.toString() ??
                                      bank['name']?.toString(),
                                  child: Text(
                                    bank['name']?.toString() ?? 'Unknown Bank',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w500,
                                      color: AppTheme.getTextPrimary(context),
                                    ),
                                  ),
                                );
                              }).toList(),
                        onChanged: _isLoadingBanks
                            ? null
                            : (value) {
                                setState(() {
                                  _selectedBank = value;
                                });
                              },
                        hint: Text(
                          _isLoadingBanks ? 'Loading banks...' : 'Select bank',
                          style: TextStyle(
                            fontSize: 15,
                            color: AppTheme.getTextSecondary(context),
                          ),
                        ),
                      ),

                      const SizedBox(height: 20),

                      // Amount (Premium Large Input)
                      TextFormField(
                        controller: _amountController,
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly
                        ],
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: theme.colorScheme.primary,
                          letterSpacing: 0.5,
                        ),
                        decoration: InputDecoration(
                          labelText: l10n.amount,
                          hintText: '0.00',
                          hintStyle: TextStyle(
                            color: AppTheme.getTextSecondary(context)
                                .withOpacity(0.4),
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                          prefixIcon: Container(
                            margin: const EdgeInsets.all(12),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  theme.colorScheme.primary.withOpacity(0.15),
                                  theme.colorScheme.primary.withOpacity(0.08),
                                ],
                              ),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              Icons.payments_rounded,
                              color: theme.colorScheme.primary,
                              size: 24,
                            ),
                          ),
                          prefixText: '₦ ',
                          prefixStyle: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: theme.colorScheme.primary,
                          ),
                          filled: true,
                          fillColor:
                              theme.colorScheme.primary.withOpacity(0.03),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 20),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: theme.colorScheme.primary.withOpacity(0.2),
                              width: 1.5,
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: theme.colorScheme.primary.withOpacity(0.2),
                              width: 1.5,
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: theme.colorScheme.primary,
                              width: 2,
                            ),
                          ),
                          errorBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: theme.colorScheme.error,
                              width: 1.5,
                            ),
                          ),
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return l10n.pleaseEnterAmount;
                          }
                          final amount = double.tryParse(value);
                          if (amount == null || amount <= 0) {
                            return l10n.pleaseEnterAmount;
                          }
                          return null;
                        },
                      ),

                      const SizedBox(height: 20),

                      // Note (Premium Input)
                      TextFormField(
                        controller: _noteController,
                        maxLength: 50,
                        textCapitalization: TextCapitalization.sentences,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          color: AppTheme.getTextPrimary(context),
                        ),
                        decoration: InputDecoration(
                          labelText: l10n.note,
                          hintText: l10n.addNote,
                          prefixIcon: Container(
                            margin: const EdgeInsets.all(12),
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: theme.colorScheme.primary.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              Icons.edit_note_rounded,
                              color: theme.colorScheme.primary,
                              size: 20,
                            ),
                          ),
                          filled: true,
                          fillColor: AppTheme.getCardBackground(context),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 18),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: AppTheme.getBorderColor(context),
                              width: 1.5,
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: AppTheme.getBorderColor(context),
                              width: 1.5,
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: theme.colorScheme.primary,
                              width: 2,
                            ),
                          ),
                          counterStyle: TextStyle(
                            fontSize: 11,
                            color: AppTheme.getTextSecondary(context),
                          ),
                        ),
                      ),

                      const SizedBox(height: 8),

                      // Note quick-select chips
                      Wrap(
                        spacing: 8,
                        children: [
                          _NoteChip(
                            label: 'QR Payment',
                            description: 'Payment made via QR code scan',
                            selected: _noteController.text == 'QR Payment',
                            primaryColor: theme.colorScheme.primary,
                            onTap: () => setState(() {
                              _noteController.text = 'QR Payment';
                            }),
                          ),
                          _NoteChip(
                            label: 'Offline Transaction',
                            description: 'Transaction queued while device was offline',
                            selected: _noteController.text == 'Offline Transaction',
                            primaryColor: theme.colorScheme.primary,
                            onTap: () => setState(() {
                              _noteController.text = 'Offline Transaction';
                            }),
                          ),
                        ],
                      ),

                      const SizedBox(height: 20),

                      // PIN (Premium Secure Input)
                      TextFormField(
                        controller: _pinController,
                        keyboardType: TextInputType.number,
                        maxLength: 4,
                        obscureText: true,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly
                        ],
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.getTextPrimary(context),
                          letterSpacing: 8,
                        ),
                        decoration: InputDecoration(
                          labelText: 'Transaction PIN',
                          hintText: '••••',
                          hintStyle: TextStyle(
                            letterSpacing: 8,
                            color: AppTheme.getTextSecondary(context)
                                .withOpacity(0.3),
                          ),
                          prefixIcon: Container(
                            margin: const EdgeInsets.all(12),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  theme.colorScheme.error.withOpacity(0.15),
                                  theme.colorScheme.error.withOpacity(0.08),
                                ],
                              ),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              Icons.lock_rounded,
                              color: theme.colorScheme.error,
                              size: 22,
                            ),
                          ),
                          filled: true,
                          fillColor: theme.colorScheme.error.withOpacity(0.03),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 20),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: theme.colorScheme.error.withOpacity(0.2),
                              width: 1.5,
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: theme.colorScheme.error.withOpacity(0.2),
                              width: 1.5,
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: theme.colorScheme.error,
                              width: 2,
                            ),
                          ),
                          errorBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: theme.colorScheme.error,
                              width: 2,
                            ),
                          ),
                          counterText: '',
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Please enter PIN';
                          }
                          if (value.length != 4) {
                            return 'PIN must be 4 digits';
                          }
                          return null;
                        },
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // Premium Info Banner
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        theme.colorScheme.primary.withOpacity(0.08),
                        theme.colorScheme.primary.withOpacity(0.04),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: theme.colorScheme.primary.withOpacity(0.2),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.primary.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(
                          Icons.info_outline_rounded,
                          size: 20,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          l10n.ensureDetailsCorrect,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: theme.colorScheme.primary,
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 32),

                // Premium Transfer Button
                Consumer<TenantProvider>(
                  builder: (context, tenantProvider, _) {
                    final isDisabled = _isProcessing ||
                        _isLoadingAccountNumber ||
                        _payerAccountNumber == null;

                    return Container(
                      height: 58,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        gradient: isDisabled
                            ? null
                            : LinearGradient(
                                colors: [
                                  tenantProvider.primaryColor,
                                  tenantProvider.primaryColor.withOpacity(0.85),
                                ],
                              ),
                        boxShadow: isDisabled
                            ? null
                            : [
                                BoxShadow(
                                  color: tenantProvider.primaryColor
                                      .withOpacity(0.4),
                                  blurRadius: 12,
                                  offset: const Offset(0, 6),
                                ),
                              ],
                      ),
                      child: ElevatedButton(
                        onPressed: isDisabled ? null : _processTransfer,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        child: _isProcessing
                            ? const SizedBox(
                                height: 24,
                                width: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                      Colors.white),
                                ),
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(
                                    Icons.send_rounded,
                                    size: 22,
                                    color: Colors.white,
                                  ),
                                  const SizedBox(width: 10),
                                  Text(
                                    _isLoadingAccountNumber
                                        ? 'Loading Account...'
                                        : (_payerAccountNumber == null
                                            ? 'Account Not Available'
                                            : 'Continue Transfer'),
                                    style: const TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                ],
                              ),
                      ),
                    );
                  },
                ),

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _payeeAccountIdController.dispose();
    _amountController.dispose();
    _noteController.dispose();
    _pinController.dispose();
    super.dispose();
  }
}

class _NoteChip extends StatelessWidget {
  final String label;
  final String description;
  final bool selected;
  final Color primaryColor;
  final VoidCallback onTap;

  const _NoteChip({
    required this.label,
    required this.description,
    required this.selected,
    required this.primaryColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: description,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? primaryColor : Colors.transparent,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected ? primaryColor : AppTheme.getBorderColor(context),
              width: 1.5,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: selected ? Colors.white : AppTheme.getTextSecondary(context),
            ),
          ),
        ),
      ),
    );
  }
}
