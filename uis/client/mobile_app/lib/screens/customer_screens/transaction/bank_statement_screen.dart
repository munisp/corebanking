import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb, debugPrint;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;
import 'package:intl/intl.dart';
import 'dart:convert';
import '../../../services/api_service.dart';
import '../../../services/wallet_service.dart';
import '../../../models/transaction.dart';

class BankStatementScreen extends StatefulWidget {
  const BankStatementScreen({super.key});

  @override
  State<BankStatementScreen> createState() => _BankStatementScreenState();
}

class _BankStatementScreenState extends State<BankStatementScreen> {
  String? _accountId; // Loaded from localStorage
  final WalletService _walletService = WalletService(ApiService());
  DateTime _startDate = DateTime.now().subtract(const Duration(days: 30));
  DateTime _endDate = DateTime.now();
  bool _isLoading = false;
  String? _errorMessage;
  List<Transaction> _transactions = [];

  @override
  void initState() {
    super.initState();
    _initializeData();
  }

  Future<void> _initializeData() async {
    await _loadAccountId();
    if (_accountId != null) {
      _fetchStatementData();
    }
  }

  /// Load account_id from localStorage/SharedPreferences (matching dashboard and transfer)
  Future<void> _loadAccountId() async {
    try {
      String? accountId;
      
      if (kIsWeb) {
        try {
          accountId = html.window.localStorage['account_id'];
          if (accountId == null) {
            // Fallback: try to get from account object
            final accountJson = html.window.localStorage['account'];
            if (accountJson != null) {
              final accountData = jsonDecode(accountJson);
              accountId = accountData['id']?.toString();
            }
          }
          // Fallback 2: Try to get from user object
          if (accountId == null) {
            final userJson = html.window.localStorage['user'];
            if (userJson != null) {
              final userData = jsonDecode(userJson);
              accountId = userData['account_id']?.toString();
            }
          }
          debugPrint('[BankStatement] Web - account_id from localStorage: $accountId');
        } catch (e) {
          debugPrint('[BankStatement] Web - Failed to load account_id: $e');
        }
      } else {
        try {
          final prefs = await SharedPreferences.getInstance();
          accountId = prefs.getString('account_id');
          if (accountId == null) {
            // Fallback: try to get from account object
            final accountJson = prefs.getString('account');
            if (accountJson != null) {
              final accountData = jsonDecode(accountJson);
              accountId = accountData['id']?.toString();
            }
          }
          // Fallback 2: Try to get from user object
          if (accountId == null) {
            final userJson = prefs.getString('user');
            if (userJson != null) {
              final userData = jsonDecode(userJson);
              accountId = userData['account_id']?.toString();
            }
          }
          debugPrint('[BankStatement] Mobile - account_id from SharedPreferences: $accountId');
        } catch (e) {
          debugPrint('[BankStatement] Mobile - Failed to load account_id: $e');
        }
      }

      setState(() {
        _accountId = accountId;
      });
      
      if (accountId == null) {
        debugPrint('[BankStatement] ⚠️ WARNING: No account_id found in storage');
      } else {
        debugPrint('[BankStatement] ✓ Successfully loaded account_id: $accountId');
      }
    } catch (e) {
      debugPrint('[BankStatement] ❌ ERROR loading account_id: $e');
      setState(() {
        _accountId = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      appBar: AppBar(title: const Text('Bank Statement')),
      body: Column(
        children: [
          // Date Range Selection
          Container(
            padding: const EdgeInsets.all(16),
            color: theme.colorScheme.surface,
            child: Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => _selectDate(true),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      decoration: BoxDecoration(
                        border: Border.all(color: theme.colorScheme.outline),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Start Date',
                            style: TextStyle(
                              fontSize: 12,
                              color: theme.colorScheme.onSurface.withOpacity(0.7),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            DateFormat('MMM dd, yyyy').format(_startDate),
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: theme.colorScheme.onSurface,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: InkWell(
                    onTap: () => _selectDate(false),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      decoration: BoxDecoration(
                        border: Border.all(color: theme.colorScheme.outline),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'End Date',
                            style: TextStyle(
                              fontSize: 12,
                              color: theme.colorScheme.onSurface.withOpacity(0.7),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            DateFormat('MMM dd, yyyy').format(_endDate),
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: theme.colorScheme.onSurface,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                IconButton(
                  onPressed: _fetchStatementData,
                  icon: const Icon(Icons.refresh),
                  tooltip: 'Refresh',
                ),
              ],
            ),
          ),
          
          // Transactions List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _errorMessage != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
                            const SizedBox(height: 16),
                            Text(
                              _errorMessage!,
                              style: TextStyle(color: theme.colorScheme.error),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              onPressed: _fetchStatementData,
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      )
                    : _transactions.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.receipt_long, size: 48, color: theme.colorScheme.onSurface.withOpacity(0.5)),
                                const SizedBox(height: 16),
                                Text(
                                  'No transactions found',
                                  style: TextStyle(
                                    color: theme.colorScheme.onSurface.withOpacity(0.7),
                                  ),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _transactions.length,
                            itemBuilder: (context, i) {
                              final transaction = _transactions[i];
                              final isCredit = transaction.type == 'credit';
                              return Card(
                                margin: const EdgeInsets.only(bottom: 8),
                                child: ListTile(
                                  title: Text(
                                    transaction.description ?? 'Transaction',
                                    style: const TextStyle(fontWeight: FontWeight.w600),
                                  ),
                                  subtitle: Text(
                                    DateFormat('MMM dd, yyyy • hh:mm a').format(transaction.createdAt),
                                  ),
                                  trailing: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        (isCredit ? '+₦' : '-₦') + transaction.amount.abs().toStringAsFixed(2),
                                        style: TextStyle(
                                          color: isCredit
                                              ? Colors.green[700]
                                              : theme.colorScheme.error,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                        ),
                                      ),
                                      Text(
                                        'Balance: ₦${transaction.balanceAfter.toStringAsFixed(2)}',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: theme.colorScheme.onSurface.withOpacity(0.6),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
          ),
          
          // Export Button
          Container(
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _transactions.isEmpty ? null : () => _exportStatement(context),
                icon: const Icon(Icons.picture_as_pdf_outlined),
                label: const Text('Export PDF'),
              ),
            ),
          ),
        ],
      ),
    );
  }
  
  Future<void> _selectDate(bool isStartDate) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: isStartDate ? _startDate : _endDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365 * 2)),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() {
        if (isStartDate) {
          _startDate = picked;
        } else {
          _endDate = picked;
        }
      });
      // Auto-fetch after date change
      _fetchStatementData();
    }
  }

  Future<void> _fetchStatementData() async {
    if (_accountId == null) {
      setState(() {
        _errorMessage = 'No account_id found. Please ensure you have an active account.';
        _isLoading = false;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      debugPrint('[BankStatement] Fetching transactions from ${_startDate.toIso8601String()} to ${_endDate.toIso8601String()}');
      
      // Fetch transactions using WalletService which calls the transaction endpoint
      final transactions = await _walletService.getTransactions(
        page: 1,
        limit: 100, // Get all transactions for the statement
        startDate: _startDate,
        endDate: _endDate,
      );

      // Sort by date (newest first)
      transactions.sort((a, b) => b.createdAt.compareTo(a.createdAt));

      setState(() {
        _transactions = transactions;
        _isLoading = false;
      });

      debugPrint('[BankStatement] Successfully loaded ${transactions.length} transactions');
    } catch (e) {
      debugPrint('[BankStatement] Error fetching transactions: $e');
      setState(() {
        _errorMessage = 'Failed to fetch transactions: ${e.toString().replaceAll('Exception: ', '')}';
        _isLoading = false;
      });
    }
  }

  Future<void> _exportStatement(BuildContext context) async {
    // final apiService = ApiService();
    // final response = await apiService.get('/transactions/statement/export');
    // Handle file download from response
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Statement export functionality coming soon')),
      );
    }
  }
}
