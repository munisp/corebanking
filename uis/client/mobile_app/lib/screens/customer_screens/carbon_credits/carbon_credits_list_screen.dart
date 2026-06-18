import 'package:flutter/material.dart';
import '../../../models/carbon_credit.dart';
import '../../../services/carbon_service.dart';
import '../../../services/error_handler_service.dart';

class CarbonCreditsListScreen extends StatefulWidget {
  const CarbonCreditsListScreen({super.key});

  @override
  State<CarbonCreditsListScreen> createState() => _CarbonCreditsListScreenState();
}

class _CarbonCreditsListScreenState extends State<CarbonCreditsListScreen> {
  final CarbonService _carbonService = CarbonService();
  
  bool _isLoading = true;
  String? _errorMessage;
  List<CarbonCredit> _credits = [];

  @override
  void initState() {
    super.initState();
    _loadCredits();
  }

  Future<void> _loadCredits() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final credits = await _carbonService.getCredits();
      setState(() {
        _credits = credits;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = ErrorHandlerService.handleError(e);
        _isLoading = false;
      });
    }
  }

  Future<void> _viewCreditDetails(String creditId) async {
    try {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(child: CircularProgressIndicator()),
      );

      final credit = await _carbonService.getCreditById(creditId);
      
      if (!mounted) return;
      Navigator.pop(context); // Close loading dialog

      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Credit Details'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildInfoRow('Credit ID', credit.id),
                _buildInfoRow('Project ID', credit.projectId),
                _buildInfoRow('Quantity', credit.quantity.toString()),
                _buildInfoRow('Price per Credit', '₦${credit.pricePerCredit.toStringAsFixed(2)}'),
                _buildInfoRow('Total Amount', '₦${credit.totalAmount.toStringAsFixed(2)}'),
                _buildInfoRow('Status', credit.status.toUpperCase()),
                _buildInfoRow('Purchase Date', _formatDate(credit.purchaseDate)),
                if (credit.retirementDate != null)
                  _buildInfoRow('Retirement Date', _formatDate(credit.retirementDate!)),
              ],
            ),
          ),
          actions: [
            if (credit.status == 'active')
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  _retireCredit(credit);
                },
                child: const Text('Retire Credit'),
              ),
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

  Future<void> _retireCredit(CarbonCredit credit) async {
    final quantityController = TextEditingController(text: credit.quantity.toString());
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Retire Carbon Credit'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: quantityController,
              decoration: const InputDecoration(
                labelText: 'Quantity to Retire',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(
                labelText: 'Retirement Reason',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
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
              final reason = reasonController.text.trim();

              if (quantity <= 0 || quantity > credit.quantity) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Invalid quantity'),
                    backgroundColor: Colors.red,
                  ),
                );
                return;
              }

              if (reason.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Please provide a retirement reason'),
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

                await _carbonService.retireCredits(
                  creditId: credit.id,
                  quantity: quantity,
                  retirementReason: reason,
                );

                if (!mounted) return;
                Navigator.pop(context); // Close loading dialog

                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Credit retired successfully'),
                    backgroundColor: Colors.green,
                  ),
                );

                _loadCredits(); // Reload credits
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
            child: const Text('Retire'),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
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

  int get _totalCredits => _credits.fold(0, (sum, credit) => sum + credit.quantity);
  
  double get _totalCO2Offset => _totalCredits * 0.5; // Assuming 1 credit = 0.5 tons CO2

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
                        onPressed: _loadCredits,
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
                      color: Colors.green[50],
                      child: Row(
                        children: [
                          Expanded(
                            child: Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  children: [
                                    const Icon(Icons.eco, size: 32, color: Colors.green),
                                    const SizedBox(height: 8),
                                    Text(
                                      _totalCredits.toString(),
                                      style: const TextStyle(
                                        fontSize: 24,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const Text('Total Credits'),
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
                                    const Icon(Icons.co2, size: 32, color: Colors.blue),
                                    const SizedBox(height: 8),
                                    Text(
                                      _totalCO2Offset.toStringAsFixed(1),
                                      style: const TextStyle(
                                        fontSize: 24,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const Text('Tons CO₂ Offset'),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    
                    // Credits List
                    Expanded(
                      child: _credits.isEmpty
                          ? const Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.credit_card, size: 60, color: Colors.grey),
                                  SizedBox(height: 16),
                                  Text(
                                    'No carbon credits yet',
                                    style: TextStyle(fontSize: 16, color: Colors.grey),
                                  ),
                                ],
                              ),
                            )
                          : RefreshIndicator(
                              onRefresh: _loadCredits,
                              child: ListView.builder(
                                padding: const EdgeInsets.all(16),
                                itemCount: _credits.length,
                                itemBuilder: (context, index) {
                                  final credit = _credits[index];
                                  return Card(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    child: InkWell(
                                      onTap: () => _viewCreditDetails(credit.id),
                                      borderRadius: BorderRadius.circular(12),
                                      child: Padding(
                                        padding: const EdgeInsets.all(16),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Text(
                                                  'Credit #${credit.id.length > 8 ? credit.id.substring(0, 8) : credit.id}',
                                                  style: const TextStyle(
                                                    fontSize: 16,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(
                                                    horizontal: 8,
                                                    vertical: 4,
                                                  ),
                                                  decoration: BoxDecoration(
                                                    color: credit.status == 'active'
                                                        ? Colors.green.withOpacity(0.2)
                                                        : Colors.grey.withOpacity(0.2),
                                                    borderRadius: BorderRadius.circular(12),
                                                  ),
                                                  child: Text(
                                                    credit.status.toUpperCase(),
                                                    style: TextStyle(
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.bold,
                                                      color: credit.status == 'active'
                                                          ? Colors.green[700]
                                                          : Colors.grey[700],
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
                                                      credit.quantity.toString(),
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
                                                      '₦${credit.totalAmount.toStringAsFixed(2)}',
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
                                              'Purchased: ${_formatDate(credit.purchaseDate)}',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: Colors.grey[600],
                                              ),
                                            ),
                                            if (credit.retirementDate != null)
                                              Text(
                                                'Retired: ${_formatDate(credit.retirementDate!)}',
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
    );
  }
}
