import 'package:flutter/foundation.dart';
import '../models/wallet.dart';
import '../models/transaction.dart';
import '../services/wallet_service.dart';
import '../services/api_service.dart';

class WalletProvider with ChangeNotifier {
  final WalletService _walletService = WalletService(ApiService());

  Wallet? _wallet;
  List<Transaction> _transactions = [];
  bool _isLoading = false;
  bool _isLoadingTransactions = false;
  String? _errorMessage;
  int _currentPage = 1;
  bool _hasMore = true;

  Wallet? get wallet => _wallet;
  List<Transaction> get transactions => _transactions;
  bool get isLoading => _isLoading;
  bool get isLoadingTransactions => _isLoadingTransactions;
  String? get errorMessage => _errorMessage;
  bool get hasMore => _hasMore;

  // Fetch wallet data
  Future<void> fetchWallet() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _wallet = await _walletService.getMyWallet();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  // Refresh wallet balance
  Future<void> refreshBalance() async {
    try {
      final balance = await _walletService.getBalance();
      if (_wallet != null) {
        _wallet = Wallet(
          id: _wallet!.id,
          userId: _wallet!.userId,
          accountNumber: _wallet!.accountNumber,
          balance: balance,
          availableBalance: balance,
          currency: _wallet!.currency,
          status: _wallet!.status,
          createdAt: _wallet!.createdAt,
          updatedAt: DateTime.now(),
        );
        notifyListeners();
      }
    } catch (e) {
      _errorMessage = e.toString();
    }
  }

  // Fetch transactions
  Future<void> fetchTransactions({bool refresh = false}) async {
    if (refresh) {
      _currentPage = 1;
      _transactions = [];
      _hasMore = true;
    }

    if (!_hasMore) return;

    _isLoadingTransactions = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final newTransactions = await _walletService.getTransactions(
        page: _currentPage,
        limit: 20,
      );

      if (newTransactions.isEmpty) {
        _hasMore = false;
      } else {
        _transactions.addAll(newTransactions);
        _currentPage++;
      }

      _isLoadingTransactions = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoadingTransactions = false;
      notifyListeners();
    }
  }

  // Load more transactions
  Future<void> loadMoreTransactions() async {
    if (!_isLoadingTransactions && _hasMore) {
      await fetchTransactions();
    }
  }

  // Refresh all data
  Future<void> refreshAll() async {
    await Future.wait([
      fetchWallet(),
      fetchTransactions(refresh: true),
    ]);
  }

  // Get transaction by ID
  Future<Transaction?> getTransaction(String transactionId) async {
    try {
      return await _walletService.getTransaction(transactionId);
    } catch (e) {
      _errorMessage = e.toString();
      return null;
    }
  }

  // Filter transactions
  List<Transaction> filterTransactions({
    String? type,
    String? category,
    String? status,
  }) {
    return _transactions.where((transaction) {
      if (type != null && transaction.type != type) return false;
      if (category != null && transaction.category != category) return false;
      if (status != null && transaction.status != status) return false;
      return true;
    }).toList();
  }

  // Get statistics
  Map<String, dynamic> getStatistics() {
    double totalCredit = 0;
    double totalDebit = 0;
    int creditCount = 0;
    int debitCount = 0;

    for (var transaction in _transactions) {
      if (transaction.isCompleted) {
        if (transaction.isCredit) {
          totalCredit += transaction.amount;
          creditCount++;
        } else {
          totalDebit += transaction.amount;
          debitCount++;
        }
      }
    }

    return {
      'total_credit': totalCredit,
      'total_debit': totalDebit,
      'credit_count': creditCount,
      'debit_count': debitCount,
      'net_flow': totalCredit - totalDebit,
    };
  }

  // Clear error
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
