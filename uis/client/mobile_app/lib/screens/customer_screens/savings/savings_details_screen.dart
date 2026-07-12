import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart' show kIsWeb, debugPrint;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;
import 'dart:convert';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../../config/app_theme.dart';
import '../../../providers/savings_provider.dart';
import '../../../models/savings.dart';


class SavingsDetailsScreen extends StatefulWidget {
  final Savings savings;


  const SavingsDetailsScreen({super.key, required this.savings});

  @override
  State<SavingsDetailsScreen> createState() => _SavingsDetailsScreenState();
}

class _SavingsDetailsScreenState extends State<SavingsDetailsScreen> {
  late Savings _savings;

   String? _payerAccountNumber;
  bool _isLoadingAccountNumber = true;

  final _contributeFormKey =
      GlobalKey<FormState>();

  @override
void initState() {
  super.initState();
  _savings = widget.savings;
  _loadUserAccount();
}

Future<void> _loadUserAccount() async {
  try {
    String? accountNumber;

    if (kIsWeb) {
      final accountJson =
          html.window.localStorage['account'];

      if (accountJson != null &&
          accountJson.isNotEmpty) {
        final accountData =
            jsonDecode(accountJson);

        accountNumber =
            accountData['account_number']
                ?.toString();
      }
    } else {
      final prefs =
          await SharedPreferences.getInstance();

      final accountJson =
          prefs.getString('account');

      if (accountJson != null &&
          accountJson.isNotEmpty) {
        final accountData =
            jsonDecode(accountJson);

        accountNumber =
            accountData['account_number']
                ?.toString();
      }
    }

    setState(() {
      _payerAccountNumber = accountNumber;
      _isLoadingAccountNumber = false;
    });
  } catch (e) {
    debugPrint(
      'Error loading account number: $e',
    );

    setState(() {
      _payerAccountNumber = null;
      _isLoadingAccountNumber = false;
    });
  }
}

  Future<void> _showContributeDialog() async {
    final amountController = TextEditingController();
final pinController = TextEditingController();

final result = await showDialog<bool>(
  context: context,
  builder: (context) => AlertDialog(
    title: const Text('Make Contribution'),
    content: Form(
      key: _contributeFormKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextFormField(
            controller: amountController,
            decoration: InputDecoration(
              labelText: 'Amount',
              prefixText: '₦ ',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            keyboardType:
                const TextInputType.numberWithOptions(
                  decimal: true,
                ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Please enter an amount';
              }

              final amount = double.tryParse(value);

              if (amount == null || amount <= 0) {
                return 'Please enter a valid amount';
              }

              return null;
            },
          ),

          const SizedBox(height: 16),

          TextFormField(
            controller: pinController,
            decoration: InputDecoration(
              labelText: 'Transaction PIN',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            keyboardType: TextInputType.number,
            obscureText: true,
            maxLength: 4,
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Please enter your PIN';
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
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context, false),
        child: const Text('Cancel'),
      ),

      ElevatedButton(
        onPressed: () async {
          if (_contributeFormKey.currentState!.validate()) {
            Navigator.pop(context, true);
          }
        },
        child: const Text('Contribute'),
      ),
    ],
  ),
);


    if (result == true && amountController.text.isNotEmpty) {
      final amount = double.parse(amountController.text);
      final provider = context.read<SavingsProvider>();
      final pin = pinController.text.trim();
      
      final success = await provider.makeContribution(
        savingsId: _savings.goal_id,
        amount: amount,
        customerAccount: _payerAccountNumber ?? '',
        pin:pin,
      );

      if (!mounted) return;

      if (success) {
        // Refresh the savings list and update local savings from the list
        await provider.fetchAllSavings();
        final updatedSavings = provider.savingsList.firstWhere(
          (s) => s.id == _savings.id,
          orElse: () => _savings,
        );
        setState(() {
          _savings = updatedSavings;
        });
        
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Contribution successful!'),
            backgroundColor: AppTheme.successColor,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(provider.errorMessage ?? 'Failed to make contribution'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    }
  }

  Future<void> _showWithdrawDialog() async {
  final amountController = TextEditingController();
  final pinController = TextEditingController();

  final formKey = GlobalKey<FormState>();

  final result = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Withdraw from Savings'),
      content: Form(
        key: formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: amountController,
              decoration: InputDecoration(
                labelText: 'Amount',
                prefixText: '₦ ',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              keyboardType:
                  const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
              validator: (value) {
                if (value == null ||
                    value.trim().isEmpty) {
                  return 'Please enter an amount';
                }

                final amount =
                    double.tryParse(value);

                if (amount == null ||
                    amount <= 0) {
                  return 'Please enter a valid amount';
                }

                if (amount >
                    _savings.currentAmount) {
                  return 'Insufficient balance';
                }

                return null;
              },
            ),

            const SizedBox(height: 16),

            TextFormField(
              controller: pinController,
              decoration: InputDecoration(
                labelText: 'Transaction PIN',
                border: OutlineInputBorder(
                  borderRadius:
                      BorderRadius.circular(12),
                ),
              ),
              keyboardType:
                  TextInputType.number,
              obscureText: true,
              maxLength: 4,
              validator: (value) {
                if (value == null ||
                    value.trim().isEmpty) {
                  return 'Please enter your PIN';
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
      actions: [
        TextButton(
          onPressed: () =>
              Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),

        ElevatedButton(
          onPressed: () async {
            if (formKey.currentState!
                .validate()) {
              Navigator.pop(context, true);
            }
          },
          style: ElevatedButton.styleFrom(
            backgroundColor:
                AppTheme.warningColor,
          ),
          child: const Text('Withdraw'),
        ),
      ],
    ),
  );

  if (result == true &&
      amountController.text.isNotEmpty) {
    final amount =
        double.parse(amountController.text);

    final provider =
        context.read<SavingsProvider>();

    final success =
        await provider.withdrawFromSavings(
      savingsId: _savings.id,
      amount: amount,
      customerAccount:
          _payerAccountNumber ?? '',
      pin: pinController.text.trim(),
    );

    if (!mounted) return;

    if (success) {
      await provider.fetchAllSavings();

      final updatedSavings =
          provider.savingsList.firstWhere(
        (s) => s.id == _savings.id,
        orElse: () => _savings,
      );

      setState(() {
        _savings = updatedSavings;
      });

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content:
              Text('Withdrawal successful!'),
          backgroundColor:
              AppTheme.successColor,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            provider.errorMessage ??
                'Failed to withdraw',
          ),
          backgroundColor:
              AppTheme.errorColor,
        ),
      );
    }
  }
}

  Future<void> _pauseSavings() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Pause Savings'),
        content: const Text('Are you sure you want to pause this savings plan?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Pause'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final provider = context.read<SavingsProvider>();
      final success = await provider.pauseSavings(_savings.id);

      if (!mounted) return;

      if (success) {
        // Refresh the savings list and update local savings from the list
        await provider.fetchAllSavings();
        final updatedSavings = provider.savingsList.firstWhere(
          (s) => s.id == _savings.id,
          orElse: () => _savings,
        );
        setState(() {
          _savings = updatedSavings;
        });
        
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Savings plan paused'),
            backgroundColor: AppTheme.successColor,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(provider.errorMessage ?? 'Failed to pause savings'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    }
  }

  Future<void> _resumeSavings() async {
    final provider = context.read<SavingsProvider>();
    final success = await provider.resumeSavings(_savings.id);

    if (!mounted) return;

    if (success) {
      // Refresh the savings list and update local savings from the list
      await provider.fetchAllSavings();
      final updatedSavings = provider.savingsList.firstWhere(
        (s) => s.id == _savings.id,
        orElse: () => _savings,
      );
      setState(() {
        _savings = updatedSavings;
      });
      
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Savings plan resumed'),
          backgroundColor: AppTheme.successColor,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.errorMessage ?? 'Failed to resume savings'),
          backgroundColor: AppTheme.errorColor,
        ),
      );
    }
  }

  Future<void> _completeSavings() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Complete Savings'),
        content: const Text(
          'Are you sure you want to mark this savings plan as completed? '
          'You can withdraw the full amount after completion.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.successColor,
            ),
            child: const Text('Complete'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final provider = context.read<SavingsProvider>();
      final success = await provider.completeSavings(_savings.id);

      if (!mounted) return;

      if (success) {
        // Refresh the savings list and update local savings from the list
        await provider.fetchAllSavings();
        final updatedSavings = provider.savingsList.firstWhere(
          (s) => s.id == _savings.id,
          orElse: () => _savings,
        );
        setState(() {
          _savings = updatedSavings;
        });
        
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Congratulations! Savings plan completed'),
            backgroundColor: AppTheme.successColor,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(provider.errorMessage ?? 'Failed to complete savings'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    }
  }

  Future<void> _deleteSavings() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Savings'),
        content: const Text(
          'Are you sure you want to delete this savings plan? '
          'This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorColor,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final provider = context.read<SavingsProvider>();
      final success = await provider.deleteSavings(_savings.id);

      if (!mounted) return;

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Savings plan deleted'),
            backgroundColor: AppTheme.successColor,
          ),
        );
        Navigator.pop(context, true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(provider.errorMessage ?? 'Failed to delete savings'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    }
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'active':
        return AppTheme.successColor;
      case 'paused':
        return AppTheme.warningColor;
      case 'completed':
        return AppTheme.primaryColor;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 2);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Savings Details'),
        elevation: 0,
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) {
              switch (value) {
                case 'delete':
                  _deleteSavings();
                  break;
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'delete',
                child: Row(
                  children: [
                    Icon(Icons.delete, color: AppTheme.errorColor),
                    SizedBox(width: 8),
                    Text('Delete Savings'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Consumer<SavingsProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          return SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header card with progress
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Theme.of(context).colorScheme.primary,
                        Theme.of(context).colorScheme.primary.withOpacity(0.8),
                      ],
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              _savings.name,
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
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
                              _savings.status.toUpperCase(),
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _savings.description,
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.white.withOpacity(0.9),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        'Current Balance',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white.withOpacity(0.8),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        currencyFormat.format(_savings.currentAmount),
                        style: const TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 16),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: LinearProgressIndicator(
                          value: _savings.progress,
                          minHeight: 12,
                          backgroundColor: Colors.white.withOpacity(0.3),
                          valueColor: const AlwaysStoppedAnimation<Color>(
                            Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${(_savings.progress * 100).toStringAsFixed(1)}% Complete',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            'Goal: ${currencyFormat.format(_savings.targetAmount)}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Action buttons
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      if (_savings.status.toLowerCase() == 'active') ...[
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: _showContributeDialog,
                            icon: const Icon(Icons.add),
                            label: const Text('Add Funds'),
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _savings.currentAmount > 0
                                ? _showWithdrawDialog
                                : null,
                            icon: const Icon(Icons.remove),
                            label: const Text('Withdraw'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                      ],
                      if (_savings.status.toLowerCase() == 'paused')
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: _resumeSavings,
                            icon: const Icon(Icons.play_arrow),
                            label: const Text('Resume Savings'),
                          ),
                        ),
                    ],
                  ),
                ),

                // Details section
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Savings Details',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.getTextPrimary(context),
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildDetailRow(
                        'Contribution',
                        '${currencyFormat.format(_savings.contributionAmount)} / ${_savings.frequency}',
                        Icons.repeat,
                      ),
                      _buildDetailRow(
                        'Start Date',
                        DateFormat('MMMM dd, yyyy').format(_savings.startDate),
                        Icons.calendar_today,
                      ),
                      if (_savings.endDate != null)
                        _buildDetailRow(
                          'End Date',
                          DateFormat('MMMM dd, yyyy').format(_savings.endDate!),
                          Icons.event,
                        ),
                      _buildDetailRow(
                        'Created',
                        DateFormat('MMMM dd, yyyy').format(_savings.createdAt),
                        Icons.access_time,
                      ),
                      if (_savings.updatedAt != null)
                        _buildDetailRow(
                          'Last Updated',
                          DateFormat('MMMM dd, yyyy').format(_savings.updatedAt!),
                          Icons.update,
                        ),
                    ],
                  ),
                ),

                // Management actions
                if (_savings.status.toLowerCase() != 'completed')
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Manage Savings',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.getTextPrimary(context),
                          ),
                        ),
                        const SizedBox(height: 16),
                        if (_savings.status.toLowerCase() == 'active')
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: _pauseSavings,
                              icon: const Icon(Icons.pause),
                              label: const Text('Pause Savings'),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                            ),
                          ),
                        const SizedBox(height: 8),
                        if (_savings.progress >= 1.0)
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _completeSavings,
                              icon: const Icon(Icons.check_circle),
                              label: const Text('Mark as Completed'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.successColor,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
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
    );
  }

  Widget _buildDetailRow(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppTheme.getTextSecondary(context)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppTheme.getTextSecondary(context),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.getTextPrimary(context),
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
