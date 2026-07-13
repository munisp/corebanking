import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../l10n/app_localizations.dart';
import '../../../config/app_theme.dart';
import '../../../providers/account_provider.dart';

class AddAccountScreen extends StatefulWidget {
  const AddAccountScreen({super.key});

  @override
  State<AddAccountScreen> createState() => _AddAccountScreenState();
}

class _AddAccountScreenState extends State<AddAccountScreen> {
  final _formKey = GlobalKey<FormState>();
  final _accountNameController = TextEditingController();
  String _selectedAccountType = 'savings';
  bool _isLoading = false;

  final Map<String, Map<String, dynamic>> _accountTypes = {
    'savings': {
      'title': 'Savings Account',
      'icon': Icons.savings_outlined,
      'description': 'Personal saving account with competitive interest rates',
      'color': Colors.green,
    },
    'current': {
      'title': 'Current Account',
      'icon': Icons.account_balance_outlined,
      'description': 'Business transactions with unlimited operations',
      'color': Colors.blue,
    },
    'fixed': {
      'title': 'Fixed Deposit',
      'icon': Icons.lock_clock_outlined,
      'description': 'Long-term investment with higher returns',
      'color': Colors.orange,
    },
    'recurring': {
      'title': 'Recurring Deposit',
      'icon': Icons.autorenew,
      'description': 'Monthly saving with guaranteed returns',
      'color': Colors.purple,
    },
    'domiciliary': {
      'title': 'Domiciliary Account',
      'icon': Icons.currency_exchange,
      'description': 'Foreign currency account',
      'color': Colors.teal,
    },
    'joint': {
      'title': 'Joint Account',
      'icon': Icons.people_outline,
      'description': 'Shared account for multiple users',
      'color': Colors.indigo,
    },
    'student': {
      'title': 'Student Account',
      'icon': Icons.school_outlined,
      'description': 'Special account for students',
      'color': Colors.cyan,
    },
    'salary': {
      'title': 'Salary Account',
      'icon': Icons.work_outline,
      'description': 'For salaried employees',
      'color': Colors.brown,
    },
    'corporate': {
      'title': 'Corporate Account',
      'icon': Icons.business_outlined,
      'description': 'For large companies and enterprises',
      'color': Colors.deepPurple,
    },
    'digital': {
      'title': 'Digital Account',
      'icon': Icons.smartphone_outlined,
      'description': 'Online banking with exclusive digital features',
      'color': Colors.pink,
    },
  };

  @override
  void dispose() {
    _accountNameController.dispose();
    super.dispose();
  }

  Future<void> _createAccount() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final accountProvider = context.read<AccountProvider>();
    final success = await accountProvider.createAccount(
      accountType: _selectedAccountType,
      accountName: _accountNameController.text.trim(),
    );

    if (!mounted) return;

    setState(() => _isLoading = false);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Account created successfully!'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context, true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(accountProvider.error ?? 'Failed to create account'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    
    final Map<String, Map<String, dynamic>> accountTypes = {
      'savings': {
        'title': l10n.savingsAccount,
        'icon': Icons.savings_outlined,
        'description': l10n.savingsAccountDesc,
        'color': Colors.green,
      },
      'current': {
        'title': l10n.currentAccount,
        'icon': Icons.account_balance_outlined,
        'description': l10n.currentAccountDesc,
        'color': Colors.blue,
      },
      'fixed': {
        'title': l10n.fixedDeposit,
        'icon': Icons.lock_clock_outlined,
        'description': l10n.fixedDepositDesc,
        'color': Colors.orange,
      },
      'recurring': {
        'title': l10n.recurringDeposit,
        'icon': Icons.autorenew,
        'description': l10n.recurringDepositDesc,
        'color': Colors.purple,
      },
      'domiciliary': {
        'title': l10n.domiciliaryAccount,
        'icon': Icons.currency_exchange,
        'description': l10n.domiciliaryAccountDesc,
        'color': Colors.teal,
      },
      'joint': {
        'title': l10n.jointAccount,
        'icon': Icons.people_outline,
        'description': l10n.jointAccountDesc,
        'color': Colors.indigo,
      },
      'student': {
        'title': l10n.studentAccount,
        'icon': Icons.school_outlined,
        'description': l10n.studentAccountDesc,
        'color': Colors.cyan,
      },
      'salary': {
        'title': l10n.salaryAccount,
        'icon': Icons.work_outline,
        'description': l10n.salaryAccountDesc,
        'color': Colors.lime,
      },
      'business': {
        'title': l10n.businessAccount,
        'icon': Icons.business_outlined,
        'description': l10n.businessAccountDesc,
        'color': Colors.brown,
      },
      'corporate': {
        'title': l10n.corporateAccount,
        'icon': Icons.business_outlined,
        'description': l10n.corporateAccountDesc,
        'color': Colors.deepPurple,
      },
      'digital': {
        'title': l10n.digitalAccount,
        'icon': Icons.smartphone_outlined,
        'description': l10n.digitalAccountDesc,
        'color': Colors.pink,
      },
    };
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.addAccount),
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Select Account Type',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.getTextPrimary(context),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Choose the type of account you want to open',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppTheme.getTextSecondary(context),
                  ),
                ),
                const SizedBox(height: 24),

                // Account Type Selection
                ...accountTypes.entries.map((entry) {
                  final type = entry.key;
                  final data = entry.value;
                  final isSelected = _selectedAccountType == type;

                  return GestureDetector(
                    onTap: () => setState(() => _selectedAccountType = type),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? (data['color'] as Color).withOpacity(0.05)
                            : Theme.of(context).cardColor,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isSelected
                              ? (data['color'] as Color)
                              : Theme.of(context).dividerColor,
                          width: isSelected ? 2 : 1,
                        ),
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                  color: (data['color'] as Color).withOpacity(0.1),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ]
                            : null,
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: (data['color'] as Color).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(
                              data['icon'] as IconData,
                              color: data['color'] as Color,
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  data['title'] as String,
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.getTextPrimary(context),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  data['description'] as String,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: AppTheme.getTextSecondary(context),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            isSelected ? Icons.check_circle : Icons.circle_outlined,
                            color: isSelected
                                ? (data['color'] as Color)
                                : AppTheme.getTextSecondary(context).withOpacity(0.5),
                            size: 24,
                          ),
                        ],
                      ),
                    ),
                  );
                }),

                const SizedBox(height: 32),

                // Account Name
                Text(
                  'Account Name',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.getTextPrimary(context),
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _accountNameController,
                  decoration: InputDecoration(
                    hintText: 'e.g., My Emergency Fund',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    prefixIcon: const Icon(Icons.account_balance_wallet_outlined),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Please enter an account name';
                    }
                    if (value.trim().length < 3) {
                      return 'Account name must be at least 3 characters';
                    }
                    return null;
                  },
                ),

                const SizedBox(height: 24),

                // Info Box
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.blue[50],
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue[200]!),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, color: Colors.blue[700]),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Your new account will be created instantly and ready to use.',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.blue[900],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 32),

                // Create Account Button
                SizedBox(
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _createAccount,
                    style: ElevatedButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 24,
                            width: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Text('Create Account'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
