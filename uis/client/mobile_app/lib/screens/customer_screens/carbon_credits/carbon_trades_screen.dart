import 'package:flutter/material.dart';
import '../../../models/carbon_trade.dart';
import '../../../models/carbon_project.dart';
import '../../../services/carbon_service.dart';
import '../../../services/error_handler_service.dart';

class CarbonTradesScreen extends StatefulWidget {
  const CarbonTradesScreen({super.key});

  @override
  State<CarbonTradesScreen> createState() => _CarbonTradesScreenState();
}

class _CarbonTradesScreenState extends State<CarbonTradesScreen> {
  final CarbonService _carbonService = CarbonService();
  
  bool _isLoading = true;
  String? _errorMessage;
  List<CarbonTrade> _trades = [];
  List<CarbonProject> _projects = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final results = await Future.wait([
        _carbonService.getTrades(),
        _carbonService.getProjects(),
      ]);

      setState(() {
        _trades = results[0] as List<CarbonTrade>;
        _projects = results[1] as List<CarbonProject>;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = ErrorHandlerService.handleError(e);
        _isLoading = false;
      });
    }
  }

  Future<void> _viewTradeDetails(String tradeId) async {
    try {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(child: CircularProgressIndicator()),
      );

      final trade = await _carbonService.getTradeById(tradeId);
      
      if (!mounted) return;
      Navigator.pop(context); // Close loading dialog

      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Trade Details'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildInfoRow('Trade ID', trade.id),
                _buildInfoRow('Type', trade.tradeType.toUpperCase()),
                _buildInfoRow('Project ID', trade.projectId),
                _buildInfoRow('Credit ID', trade.creditId),
                _buildInfoRow('Quantity', trade.quantity.toString()),
                _buildInfoRow('Price per Credit', '₦${trade.pricePerCredit.toStringAsFixed(2)}'),
                _buildInfoRow('Total Amount', '₦${trade.totalAmount.toStringAsFixed(2)}'),
                _buildInfoRow('Status', trade.status.toUpperCase()),
                _buildInfoRow('Trade Date', _formatDate(trade.tradeDate)),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context); // Close loading dialog
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ErrorHandlerService.handleError(e)),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _purchaseCredits(CarbonProject project) async {
    final quantityController = TextEditingController(text: '1');

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Purchase from ${project.name}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              project.description,
              style: TextStyle(color: Colors.grey[700]),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: quantityController,
              decoration: InputDecoration(
                labelText: 'Quantity',
                border: const OutlineInputBorder(),
                helperText: 'Available: ${project.availableCredits}',
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.green[50],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Price per Credit:'),
                      Text(
                        '₦${project.pricePerCredit.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Impact per Credit:'),
                      Text(
                        '${project.impactPerCredit.toStringAsFixed(2)} tons CO₂',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              final quantity = int.tryParse(quantityController.text) ?? 0;

              if (quantity <= 0) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Invalid quantity'),
                    backgroundColor: Colors.red,
                  ),
                );
                return;
              }

              if (quantity > project.availableCredits) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Quantity exceeds available credits'),
                    backgroundColor: Colors.red,
                  ),
                );
                return;
              }

              Navigator.pop(context);

              try {
                showDialog(
                  context: context,
                  barrierDismissible: false,
                  builder: (context) => const Center(child: CircularProgressIndicator()),
                );

                final trade = await _carbonService.purchaseCredits(
                  projectId: project.id,
                  quantity: quantity,
                  pricePerCredit: project.pricePerCredit,
                );

                if (!mounted) return;
                Navigator.pop(context); // Close loading dialog

                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Successfully purchased $quantity credit(s)!'),
                    backgroundColor: Colors.green,
                  ),
                );

                _loadData(); // Reload trades
              } catch (e) {
                if (!mounted) return;
                Navigator.pop(context); // Close loading dialog

                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(ErrorHandlerService.handleError(e)),
                    backgroundColor: Colors.red,
                  ),
                );
              }
            },
            child: const Text('Purchase'),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              '$label:',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(
            child: Text(value),
          ),
        ],
      ),
    );
  }

  int get _totalBought => _trades
      .where((t) => t.tradeType == 'buy')
      .fold(0, (sum, trade) => sum + trade.quantity);

  int get _totalSold => _trades
      .where((t) => t.tradeType == 'sell')
      .fold(0, (sum, trade) => sum + trade.quantity);

  double get _totalSpent => _trades
      .where((t) => t.tradeType == 'buy')
      .fold(0.0, (sum, trade) => sum + trade.totalAmount);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 60, color: Colors.red),
                      const SizedBox(height: 16),
                      Text(
                        _errorMessage!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.red),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadData,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    // Summary Cards
                    Container(
                      padding: const EdgeInsets.all(16),
                      color: Colors.blue[50],
                      child: Row(
                        children: [
                          Expanded(
                            child: Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  children: [
                                    const Icon(Icons.shopping_cart, size: 32, color: Colors.blue),
                                    const SizedBox(height: 8),
                                    Text(
                                      _totalBought.toString(),
                                      style: const TextStyle(
                                        fontSize: 24,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const Text('Credits Bought'),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  children: [
                                    const Icon(Icons.attach_money, size: 32, color: Colors.green),
                                    const SizedBox(height: 8),
                                    Text(
                                      '₦${_totalSpent.toStringAsFixed(0)}',
                                      style: const TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const Text('Total Spent'),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    
                    // Available Projects Section
                    if (_projects.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Available Projects',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            SizedBox(
                              height: 120,
                              child: ListView.builder(
                                scrollDirection: Axis.horizontal,
                                itemCount: _projects.length,
                                itemBuilder: (context, index) {
                                  final project = _projects[index];
                                  return Card(
                                    margin: const EdgeInsets.only(right: 12),
                                    child: InkWell(
                                      onTap: () => _purchaseCredits(project),
                                      child: Container(
                                        width: 200,
                                        padding: const EdgeInsets.all(12),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              project.name,
                                              style: const TextStyle(
                                                fontWeight: FontWeight.bold,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              project.location,
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: Colors.grey[600],
                                              ),
                                            ),
                                            const Spacer(),
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Text(
                                                  '₦${project.pricePerCredit.toStringAsFixed(0)}',
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.green,
                                                  ),
                                                ),
                                                Text(
                                                  '${project.availableCredits} avail',
                                                  style: TextStyle(
                                                    fontSize: 12,
                                                    color: Colors.grey[600],
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                    
                    // Trades History
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 16),
                            child: Text(
                              'Trade History',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Expanded(
                            child: _trades.isEmpty
                                ? const Center(
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Icon(Icons.history, size: 60, color: Colors.grey),
                                        SizedBox(height: 16),
                                        Text(
                                          'No trades yet',
                                          style: TextStyle(fontSize: 16, color: Colors.grey),
                                        ),
                                      ],
                                    ),
                                  )
                                : RefreshIndicator(
                                    onRefresh: _loadData,
                                    child: ListView.builder(
                                      padding: const EdgeInsets.symmetric(horizontal: 16),
                                      itemCount: _trades.length,
                                      itemBuilder: (context, index) {
                                        final trade = _trades[index];
                                        final isBuy = trade.tradeType == 'buy';
                                        
                                        return Card(
                                          margin: const EdgeInsets.only(bottom: 12),
                                          child: InkWell(
                                            onTap: () => _viewTradeDetails(trade.id),
                                            borderRadius: BorderRadius.circular(12),
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
                                                          Icon(
                                                            isBuy ? Icons.arrow_downward : Icons.arrow_upward,
                                                            color: isBuy ? Colors.green : Colors.orange,
                                                            size: 20,
                                                          ),
                                                          const SizedBox(width: 8),
                                                          Text(
                                                            trade.tradeType.toUpperCase(),
                                                            style: TextStyle(
                                                              fontSize: 16,
                                                              fontWeight: FontWeight.bold,
                                                              color: isBuy ? Colors.green : Colors.orange,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                      Container(
                                                        padding: const EdgeInsets.symmetric(
                                                          horizontal: 8,
                                                          vertical: 4,
                                                        ),
                                                        decoration: BoxDecoration(
                                                          color: trade.status == 'completed'
                                                              ? Colors.green.withOpacity(0.2)
                                                              : Colors.orange.withOpacity(0.2),
                                                          borderRadius: BorderRadius.circular(12),
                                                        ),
                                                        child: Text(
                                                          trade.status.toUpperCase(),
                                                          style: TextStyle(
                                                            fontSize: 12,
                                                            fontWeight: FontWeight.bold,
                                                            color: trade.status == 'completed'
                                                                ? Colors.green[700]
                                                                : Colors.orange[700],
                                                          ),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                  const SizedBox(height: 12),
                                                  Row(
                                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                    children: [
                                                      Column(
                                                        crossAxisAlignment: CrossAxisAlignment.start,
                                                        children: [
                                                          Text(
                                                            'Quantity',
                                                            style: TextStyle(
                                                              fontSize: 12,
                                                              color: Colors.grey[600],
                                                            ),
                                                          ),
                                                          const SizedBox(height: 4),
                                                          Text(
                                                            trade.quantity.toString(),
                                                            style: const TextStyle(
                                                              fontSize: 18,
                                                              fontWeight: FontWeight.bold,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                      Column(
                                                        crossAxisAlignment: CrossAxisAlignment.end,
                                                        children: [
                                                          Text(
                                                            'Total Amount',
                                                            style: TextStyle(
                                                              fontSize: 12,
                                                              color: Colors.grey[600],
                                                            ),
                                                          ),
                                                          const SizedBox(height: 4),
                                                          Text(
                                                            '₦${trade.totalAmount.toStringAsFixed(2)}',
                                                            style: const TextStyle(
                                                              fontSize: 18,
                                                              fontWeight: FontWeight.bold,
                                                              color: Colors.green,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ],
                                                  ),
                                                  const SizedBox(height: 8),
                                                  Text(
                                                    _formatDate(trade.tradeDate),
                                                    style: TextStyle(
                                                      fontSize: 12,
                                                      color: Colors.grey[600],
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        );
                                      },
                                    ),
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
