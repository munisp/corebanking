import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../config/app_config.dart';
import '../../../config/app_theme.dart';
import '../../../services/api_service.dart';

class FXScreen extends StatefulWidget {
  const FXScreen({super.key});

  @override
  State<FXScreen> createState() => _FXScreenState();
}

class _FXScreenState extends State<FXScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ApiService _api = ApiService();

  List<Map<String, dynamic>> _exchangeRates = [];
  List<Map<String, dynamic>> _transactions = [];
  bool _loadingRates = false;
  bool _loadingTransactions = false;
  String? _ratesError;
  String? _transactionsError;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadRates();
    _loadTransactions();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadRates() async {
    setState(() { _loadingRates = true; _ratesError = null; });
    try {
      final response = await _api.get('${AppConfig.fxEndpoint}/rates');
      final data = response.data;
      List<dynamic> raw = [];
      if (data is List) {
        raw = data;
      } else if (data is Map && data['data'] is List) {
        raw = data['data'] as List;
      } else if (data is Map && data['rates'] is List) {
        raw = data['rates'] as List;
      }
      setState(() {
        _exchangeRates = raw.map((r) => Map<String, dynamic>.from(r as Map)).toList();
        _loadingRates = false;
      });
    } catch (e) {
      setState(() { _ratesError = e.toString(); _loadingRates = false; });
    }
  }

  Future<void> _loadTransactions() async {
    setState(() { _loadingTransactions = true; _transactionsError = null; });
    try {
      final response = await _api.get('${AppConfig.fxEndpoint}/transactions');
      final data = response.data;
      List<dynamic> raw = [];
      if (data is List) {
        raw = data;
      } else if (data is Map && data['data'] is List) {
        raw = data['data'] as List;
      } else if (data is Map && data['transactions'] is List) {
        raw = data['transactions'] as List;
      }
      setState(() {
        _transactions = raw.map((t) => Map<String, dynamic>.from(t as Map)).toList();
        _loadingTransactions = false;
      });
    } catch (e) {
      setState(() { _transactionsError = e.toString(); _loadingTransactions = false; });
    }
  }

  Future<void> _handleRefresh() async {
    await Future.wait([_loadRates(), _loadTransactions()]);
  }

  void _showExchangeDialog(Map<String, dynamic> rate) {
    final currency = (rate['currency'] ?? rate['foreign_currency'] ?? rate['to_currency'] ?? '').toString();
    final buyRate = (rate['buy_rate'] ?? rate['buyRate'] ?? rate['rate'] ?? 0).toDouble();
    final amountController = TextEditingController();
    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 2);

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          final amountVal = double.tryParse(amountController.text) ?? 0;
          final nairaEquiv = amountVal * buyRate;

          return AlertDialog(
            title: Text('Buy $currency'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Rate: ${currencyFormat.format(buyRate)} per $currency'),
                const SizedBox(height: 16),
                TextField(
                  controller: amountController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: 'Amount ($currency)',
                    border: const OutlineInputBorder(),
                  ),
                  onChanged: (_) => setDialogState(() {}),
                ),
                if (amountVal > 0) ...[
                  const SizedBox(height: 12),
                  Text('You pay: ${currencyFormat.format(nairaEquiv)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
              ElevatedButton(
                onPressed: amountVal > 0 ? () => _executeExchange(rate, amountVal, context) : null,
                child: const Text('Exchange'),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _executeExchange(Map<String, dynamic> rate, double amount, BuildContext dialogContext) async {
    Navigator.pop(dialogContext);
    final currency = (rate['currency'] ?? rate['foreign_currency'] ?? '').toString();
    try {
      await _api.post('${AppConfig.fxEndpoint}/exchange', data: {
        'from_currency': 'NGN',
        'to_currency': currency,
        'amount': amount,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Exchange of $amount $currency initiated'), backgroundColor: Colors.green),
      );
      _loadTransactions();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Exchange failed: ${e.toString()}'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 2);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Foreign Exchange'),
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Exchange Rates'),
            Tab(text: 'My Transactions'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Exchange Rates Tab
          RefreshIndicator(
            onRefresh: _handleRefresh,
            child: _loadingRates
                ? const Center(child: CircularProgressIndicator())
                : _ratesError != null
                    ? _buildError(_ratesError!, _loadRates)
                    : _exchangeRates.isEmpty
                        ? _buildEmpty('No exchange rates available', Icons.currency_exchange_outlined)
                        : ListView(
                            padding: const EdgeInsets.all(16),
                            children: [
                              Card(
                                color: AppTheme.primaryColor.withOpacity(0.1),
                                elevation: 0,
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Row(
                                    children: [
                                      Icon(Icons.info_outline, color: AppTheme.primaryColor),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Text(
                                          'Rates are updated in real-time and may vary slightly at checkout',
                                          style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(height: 16),
                              ..._exchangeRates.map((rate) => _buildRateCard(rate, currencyFormat)),
                            ],
                          ),
          ),

          // Transactions Tab
          RefreshIndicator(
            onRefresh: _handleRefresh,
            child: _loadingTransactions
                ? const Center(child: CircularProgressIndicator())
                : _transactionsError != null
                    ? _buildError(_transactionsError!, _loadTransactions)
                    : _transactions.isEmpty
                        ? _buildEmpty('No FX transactions yet', Icons.swap_horiz_outlined)
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _transactions.length,
                            itemBuilder: (context, index) => _buildTransactionCard(_transactions[index], currencyFormat),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildError(String error, VoidCallback retry) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
          const SizedBox(height: 16),
          Text('Failed to load data', style: TextStyle(fontSize: 16, color: Colors.grey[700])),
          const SizedBox(height: 8),
          Text(error, style: TextStyle(fontSize: 12, color: Colors.grey[500]), textAlign: TextAlign.center),
          const SizedBox(height: 16),
          ElevatedButton.icon(onPressed: retry, icon: const Icon(Icons.refresh), label: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _buildEmpty(String message, IconData icon) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 64, color: Colors.grey[400]),
          const SizedBox(height: 16),
          Text(message, style: TextStyle(fontSize: 16, color: Colors.grey[600])),
        ],
      ),
    );
  }

  Widget _buildRateCard(Map<String, dynamic> rate, NumberFormat currencyFormat) {
    final currency = (rate['currency'] ?? rate['foreign_currency'] ?? rate['to_currency'] ?? '').toString();
    final buyRate = (rate['buy_rate'] ?? rate['buyRate'] ?? rate['rate'] ?? 0).toDouble();
    final sellRate = (rate['sell_rate'] ?? rate['sellRate'] ?? buyRate * 1.02).toDouble();
    final change = (rate['change_pct'] ?? rate['change'] ?? 0).toDouble();
    final isPositive = change >= 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: () => _showExchangeDialog(rate),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(currency, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        Text((rate['currency_name'] ?? currency).toString(), style: TextStyle(fontSize: 13, color: Colors.grey[600])),
                      ],
                    ),
                  ),
                  if (change != 0)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: (isPositive ? Colors.green : Colors.red).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(isPositive ? Icons.arrow_upward : Icons.arrow_downward, size: 14, color: isPositive ? Colors.green : Colors.red),
                          const SizedBox(width: 4),
                          Text('${change.abs().toStringAsFixed(2)}%', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: isPositive ? Colors.green : Colors.red)),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                      child: Column(
                        children: [
                          Text('Buy Rate', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                          const SizedBox(height: 4),
                          Text(currencyFormat.format(buyRate), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.green)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: Colors.orange.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                      child: Column(
                        children: [
                          Text('Sell Rate', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                          const SizedBox(height: 4),
                          Text(currencyFormat.format(sellRate), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.orange)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTransactionCard(Map<String, dynamic> tx, NumberFormat currencyFormat) {
    final fromCurrency = (tx['from_currency'] ?? tx['fromCurrency'] ?? 'NGN').toString();
    final toCurrency = (tx['to_currency'] ?? tx['toCurrency'] ?? '').toString();
    final fromAmount = (tx['from_amount'] ?? tx['fromAmount'] ?? tx['amount'] ?? 0).toDouble();
    final toAmount = (tx['to_amount'] ?? tx['toAmount'] ?? 0).toDouble();
    final rate = (tx['rate'] ?? 0).toDouble();
    final status = (tx['status'] ?? '').toString();
    final createdAt = (tx['created_at'] ?? tx['createdAt'] ?? '').toString();
    final isBuy = fromCurrency == 'NGN';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: (isBuy ? Colors.green : Colors.orange).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(isBuy ? Icons.arrow_downward : Icons.arrow_upward, color: isBuy ? Colors.green : Colors.orange, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Text('${isBuy ? "Buy" : "Sell"} $toCurrency', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: status.toLowerCase() == 'completed' ? Colors.green.withOpacity(0.1) : Colors.orange.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(status, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: status.toLowerCase() == 'completed' ? Colors.green : Colors.orange)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.grey[50], borderRadius: BorderRadius.circular(12)),
              child: Column(
                children: [
                  _txRow('Amount', '$toCurrency ${toAmount.toStringAsFixed(2)}'),
                  const SizedBox(height: 8),
                  if (rate > 0) _txRow('Rate', currencyFormat.format(rate)),
                  const SizedBox(height: 8),
                  _txRow('Total (NGN)', currencyFormat.format(fromAmount)),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                const SizedBox(width: 6),
                Text(createdAt.length >= 10 ? createdAt.substring(0, 10) : createdAt, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _txRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(fontSize: 13, color: Colors.grey[600])),
        Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      ],
    );
  }
}
