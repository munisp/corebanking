import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter/foundation.dart' show kIsWeb, debugPrint;
import 'package:provider/provider.dart';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;
import '../../../config/app_theme.dart';
import '../../../services/wallet_service.dart';
import '../../../services/api_service.dart';
import '../../../models/transaction.dart';
import '../../../providers/tenant_provider.dart';
import '../../../utils/theme_extensions.dart';
import 'transaction_details_screen.dart';

class TransactionHistoryScreen extends StatefulWidget {
  const TransactionHistoryScreen({super.key});

  @override
  State<TransactionHistoryScreen> createState() =>
      _TransactionHistoryScreenState();
}

class _TransactionHistoryScreenState extends State<TransactionHistoryScreen> {
  final WalletService _walletService = WalletService(ApiService());
  List<Transaction> transactions = [];
  bool loading = true;
  String? error;
  int page = 1;
  bool loadingMore = false;
  bool endReached = false;
  String? _accountId; // Loaded from localStorage

  @override
  void initState() {
    super.initState();
    _initializeData();
  }

  /// Initialize data by loading account_id first, then transactions
  Future<void> _initializeData() async {
    await _loadAccountId();
    await _loadTransactions();
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
          debugPrint(
              '[TransactionHistory] Web - account_id from localStorage: $accountId');
        } catch (e) {
          debugPrint(
              '[TransactionHistory] Web - Failed to load account_id: $e');
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
          debugPrint(
              '[TransactionHistory] Mobile - account_id from SharedPreferences: $accountId');
        } catch (e) {
          debugPrint(
              '[TransactionHistory] Mobile - Failed to load account_id: $e');
        }
      }

      setState(() {
        _accountId = accountId;
      });

      if (accountId == null) {
        debugPrint(
            '[TransactionHistory] ⚠️ WARNING: No account_id found in storage');
      } else {
        debugPrint(
            '[TransactionHistory] ✓ Successfully loaded account_id: $accountId');
      }
    } catch (e) {
      debugPrint('[TransactionHistory] ❌ ERROR loading account_id: $e');
      setState(() {
        _accountId = null;
      });
    }
  }

  Future<void> _loadTransactions({bool loadMore = false}) async {
    if (loadMore && endReached) return;

    if (!loadMore) {
      setState(() {
        loading = true;
        error = null;
      });
    }

    try {
      debugPrint(
          '[TransactionHistory] Fetching transactions with account_id: $_accountId');

      final data = await _walletService.getTransactions(page: page);

      if (data.isEmpty) {
        setState(() {
          endReached = true;
          loading = false;
        });
        return;
      }

      setState(() {
        if (loadMore) {
          transactions.addAll(data);
        } else {
          transactions = data;
        }
        loading = false;
        loadingMore = false;
      });

      debugPrint(
          '[TransactionHistory] Successfully loaded ${data.length} transactions');
    } catch (e) {
      debugPrint('[TransactionHistory] ❌ ERROR loading transactions: $e');
      setState(() {
        error = e.toString();
        loading = false;
        loadingMore = false;
      });
    }
  }

  Future<void> _handleRefresh() async {
    setState(() {
      page = 1;
      endReached = false;
    });
    await _loadAccountId(); // Reload account_id on refresh
    await _loadTransactions();
  }

  void _loadMore() {
    if (loadingMore || endReached) return;
    setState(() {
      loadingMore = true;
      page++;
    });
    _loadTransactions(loadMore: true);
  }

  /// Matches web app: Determine if transaction is credit or debit based on payer/payee
  /// Note: This is a synchronous helper, account_id should already be determined in wallet_service
  String _getTransactionType(Transaction tx) {
    // If type is already set correctly, use it
    if (tx.type.isNotEmpty && tx.type != 'unknown') {
      return tx.type;
    }
    
    // Try to determine from metadata if type is not properly set
    if (tx.metadata != null && _accountId != null) {
      final payer = tx.metadata!['payer']?.toString();
      final payee = tx.metadata!['payee']?.toString();
      
      if (payee == _accountId) {
        return tx.metadata!['note'].contains( "transfer")?"debit": 'credit';  // User is receiving money
      } else if (payer == _accountId) {
        return tx.metadata!['note'].contains( "transfer")?"credit": 'debit';   // User is sending money
      }
    }

    // Use existing type as fallback
    return tx.type;
  }

  Color _getTransactionColor(String type, BuildContext context) {
    final theme = Theme.of(context);
    switch (type.toLowerCase()) {
      case 'credit':
        return theme.successColor;
      case 'debit':
        return theme.colorScheme.error;
      default:
        return theme.colorScheme.onSurface.withOpacity(0.5);
    }
  }

  IconData _getTransactionIcon(String type) {
    switch (type.toLowerCase()) {
      case 'credit':
        return Icons.arrow_downward;
      case 'debit':
        return Icons.arrow_upward;
      default:
        return Icons.swap_horiz;
    }
  }

  Color _getStatusColor(String status, BuildContext context) {
    final theme = Theme.of(context);
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return theme.successColor;
      case 'pending':
        return theme.warningColor;
      case 'failed':
        return theme.colorScheme.error;
      default:
        return theme.colorScheme.onSurface.withOpacity(0.5);
    }
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inDays == 0) {
      return DateFormat('HH:mm').format(date);
    } else if (diff.inDays == 1) {
      return 'Yesterday';
    } else if (diff.inDays < 7) {
      return '${diff.inDays}d ago';
    } else {
      return DateFormat('MMM dd').format(date);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 2);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Transaction History", style: TextStyle(fontWeight: FontWeight.bold)),
        elevation: 0,
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Theme.of(context).colorScheme.primary.withOpacity(0.1),
                  Theme.of(context).colorScheme.primary.withOpacity(0.05),
                ],
              ),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: Theme.of(context).colorScheme.primary.withOpacity(0.2),
                width: 1,
              ),
            ),
            child: IconButton(
              icon: const Icon(Icons.filter_list_rounded),
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Filter functionality coming soon!')),
                );
              },
              tooltip: 'Filter',
            ),
          ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Theme.of(context).colorScheme.error.withOpacity(0.1),
                              Theme.of(context).colorScheme.error.withOpacity(0.05),
                            ],
                          ),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.error_outline_rounded,
                          size: 64,
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        'Error loading transactions',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.getTextPrimary(context),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 32),
                        child: Text(
                          "Need help? Please check your internet connection and try again. or verify your kyc setup in the settings.",
                          style: TextStyle(color: AppTheme.getTextSecondary(context)),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      if (_accountId != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Account ID: $_accountId',
                          style: TextStyle(
                            color: AppTheme.getTextSecondary(context).withOpacity(0.7),
                            fontSize: 12,
                          ),
                        ),
                      ],
                      const SizedBox(height: 32),
                      Consumer<TenantProvider>(
                        builder: (context, tenantProvider, _) {
                          return Container(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  tenantProvider.primaryColor,
                                  tenantProvider.primaryColor.withOpacity(0.85),
                                ],
                              ),
                              borderRadius: BorderRadius.circular(14),
                              boxShadow: [
                                BoxShadow(
                                  color: tenantProvider.primaryColor.withOpacity(0.3),
                                  blurRadius: 8,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: ElevatedButton.icon(
                              onPressed: _handleRefresh,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.transparent,
                                shadowColor: Colors.transparent,
                                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                              icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                              label: const Text(
                                'Retry',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                )
              : transactions.isEmpty
                  ? RefreshIndicator(
                      onRefresh: _handleRefresh,
                      child: ListView(
                        children: [
                          SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                          Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(28),
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [
                                        Theme.of(context).colorScheme.primary.withOpacity(0.1),
                                        Theme.of(context).colorScheme.primary.withOpacity(0.05),
                                      ],
                                    ),
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(
                                    Icons.receipt_long_rounded,
                                    size: 80,
                                    color: Theme.of(context).colorScheme.primary.withOpacity(0.6),
                                  ),
                                ),
                                const SizedBox(height: 24),
                                Text(
                                  'No Transactions Yet',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    color: AppTheme.getTextPrimary(context),
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 48),
                                  child: Text(
                                    'Your transaction history will appear here',
                                    style: TextStyle(
                                      color: AppTheme.getTextSecondary(context),
                                      fontSize: 14,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _handleRefresh,
                      child: NotificationListener<ScrollNotification>(
                        onNotification: (scrollInfo) {
                          if (scrollInfo.metrics.pixels == scrollInfo.metrics.maxScrollExtent &&
                              !loadingMore) {
                            _loadMore();
                          }
                          return false;
                        },
                        child: ListView.builder(
                          padding: const EdgeInsets.all(20),
                          itemCount: transactions.length + (loadingMore ? 1 : 0),
                          itemBuilder: (context, index) {
                            if (index == transactions.length) {
                              return const Padding(
                                padding: EdgeInsets.all(16),
                                child: Center(child: CircularProgressIndicator()),
                              );
                            }

                            final tx = transactions[index];
                            final txType = _getTransactionType(tx);
                            final transactionColor = _getTransactionColor(txType, context);
                            final transactionIcon = _getTransactionIcon(txType);
                            // print('Transaction ${tx.transaction_id} is of type $txType');

                            return Container(
                              margin: const EdgeInsets.only(bottom: 14),
                              decoration: BoxDecoration(
                                color: AppTheme.getCardBackground(context),
                                borderRadius: BorderRadius.circular(18),
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
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (context) => TransactionDetailsScreen(
                                          transactionId: tx.transaction_id,
                                        ),
                                      ),
                                    );
                                  },
                                  borderRadius: BorderRadius.circular(18),
                                  child: Padding(
                                    padding: const EdgeInsets.all(18),
                                    child: Row(
                                      children: [
                                        // Premium Icon Container
                                        Container(
                                          padding: const EdgeInsets.all(14),
                                          decoration: BoxDecoration(
                                            gradient: LinearGradient(
                                              colors: [
                                                transactionColor.withOpacity(0.15),
                                                transactionColor.withOpacity(0.08),
                                              ],
                                            ),
                                            borderRadius: BorderRadius.circular(14),
                                            border: Border.all(
                                              color: transactionColor.withOpacity(0.2),
                                              width: 1,
                                            ),
                                          ),
                                          child: Icon(
                                            transactionIcon,
                                            color: transactionColor,
                                            size: 26,
                                          ),
                                        ),
                                        const SizedBox(width: 14),
                                        // Transaction Details
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                tx.description ?? "Transaction",
                                                style: TextStyle(
                                                  fontWeight: FontWeight.w700,
                                                  fontSize: 15,
                                                  color: AppTheme.getTextPrimary(context),
                                                  letterSpacing: 0.2,
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                              const SizedBox(height: 6),
                                              Row(
                                                children: [
                                                  // Status Badge
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(
                                                      horizontal: 10,
                                                      vertical: 4,
                                                    ),
                                                    decoration: BoxDecoration(
                                                      gradient: LinearGradient(
                                                        colors: [
                                                          _getStatusColor(tx.status, context).withOpacity(0.15),
                                                          _getStatusColor(tx.status, context).withOpacity(0.08),
                                                        ],
                                                      ),
                                                      borderRadius: BorderRadius.circular(8),
                                                      border: Border.all(
                                                        color: _getStatusColor(tx.status, context).withOpacity(0.3),
                                                        width: 1,
                                                      ),
                                                    ),
                                                    child: Text(
                                                      tx.status.toUpperCase(),
                                                      style: TextStyle(
                                                        fontSize: 10,
                                                        fontWeight: FontWeight.bold,
                                                        color: _getStatusColor(tx.status, context),
                                                        letterSpacing: 0.5,
                                                      ),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  // Type Label
                                                  Text(
                                                    tx.type.toUpperCase(),
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      fontWeight: FontWeight.w600,
                                                      color: AppTheme.getTextSecondary(context),
                                                      letterSpacing: 0.3,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(width: 14),
                                        // Amount and Date
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            Text(
                                              currencyFormat.format(tx.amount),
                                              style: TextStyle(
                                                color: transactionColor,
                                                fontWeight: FontWeight.bold,
                                                fontSize: 12,
                                                letterSpacing: 0.3,
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                              decoration: BoxDecoration(
                                                color: AppTheme.getTextSecondary(context).withOpacity(0.1),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                _formatDate(tx.createdAt),
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w600,
                                                  color: AppTheme.getTextSecondary(context),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ),
    );
  }
}
