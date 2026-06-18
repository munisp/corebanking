import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../../providers/tenant_provider.dart';
import '../../../services/api_service.dart';

class TransferReceiptScreen extends StatefulWidget {
  final String transactionReference;

  const TransferReceiptScreen({
    super.key,
    required this.transactionReference,
  });

  @override
  State<TransferReceiptScreen> createState() => _TransferReceiptScreenState();
}

class _TransferReceiptScreenState extends State<TransferReceiptScreen>
    with SingleTickerProviderStateMixin {
  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic>? _transaction;
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeIn),
    );
    _scaleAnimation = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOutBack),
    );
    _fetchTransaction();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _fetchTransaction() async {
    try {
      debugPrint('[Receipt] Fetching transaction: ${widget.transactionReference}');
      final apiService = ApiService();
      final response = await apiService.getTransactionById(widget.transactionReference);
      
      debugPrint('[Receipt] Response: $response');
      
      if (mounted) {
        // The API returns {"message": "success", "transaction": {...}}
        final transactionData = response['transaction'] ?? response['data'] ?? response;
        
        if (transactionData == null) {
          throw Exception('No transaction data returned from API');
        }
        
        setState(() {
          _transaction = transactionData;
          _isLoading = false;
        });
        _animationController.forward();
      }
    } catch (e) {
      debugPrint('[Receipt] Error fetching transaction: $e');
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  String _formatCurrency(dynamic amount) {
    try {
      final number = double.tryParse(amount.toString()) ?? 0.0;
      final formatter = NumberFormat.currency(symbol: '₦', decimalDigits: 2);
      return formatter.format(number);
    } catch (e) {
      return '₦0.00';
    }
  }

  String _formatDate(String? dateString) {
    if (dateString == null) return 'N/A';
    try {
      final date = DateTime.parse(dateString);
      return DateFormat('MMM dd, yyyy • hh:mm a').format(date);
    } catch (e) {
      return dateString;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tenantProvider = Provider.of<TenantProvider>(context);
    final primaryColor = _parseColor(Theme.of( context).colorScheme.primary.value.toRadixString(16));
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_isLoading) {
      return Scaffold(
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [primaryColor, primaryColor.withOpacity(0.7)],
            ),
          ),
          child: const Center(
            child: CircularProgressIndicator(color: Colors.white),
          ),
        ),
      );
    }

    if (_errorMessage != null) {
      return Scaffold(
        backgroundColor: isDark ? const Color(0xFF121212) : Colors.grey[100],
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline,
                  size: 64,
                  color: Colors.red[400],
                ),
                const SizedBox(height: 16),
                Text(
                  'Failed to Load Receipt',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _isLoading = true;
                      _errorMessage = null;
                    });
                    _fetchTransaction();
                  },
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final transaction = _transaction!;
    final amount = transaction['amount'] ?? 0;
    final status = transaction['status'] ?? 'pending';
    final payeeName = transaction['payee_name'] ?? 'N/A';
    final payeeAccountNumber = transaction['payee_account_number'] ?? 'N/A';
    final payerName = transaction['payer_name'] ?? 'N/A';
    final payerAccountNumber = transaction['payer_account_number'] ?? 'N/A';
    final createdAt = transaction['created_at'];
    final completedAt = transaction['completed_at'];
    final note = transaction['note'] ?? 'No description';
    final transactionId = transaction['transaction_id'] ?? widget.transactionReference;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              primaryColor,
              primaryColor.withOpacity(0.8),
              isDark ? const Color(0xFF121212) : Colors.grey[100]!,
            ],
            stops: const [0.0, 0.3, 0.6],
          ),
        ),
        child: SafeArea(
          child: Stack(
            children: [
              SingleChildScrollView(
                child: Column(
                  children: [
                    const SizedBox(height: 60),
                    
                    // Success Animation
                    FadeTransition(
                      opacity: _fadeAnimation,
                      child: ScaleTransition(
                        scale: _scaleAnimation,
                        child: Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            shape: BoxShape.circle,
                          ),
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              status == 'completed' || status == 'success'
                                  ? Icons.check_circle
                                  : status == 'pending'
                                      ? Icons.pending
                                      : Icons.error,
                              size: 48,
                              color: status == 'completed' || status == 'success'
                                  ? Colors.green[600]
                                  : status == 'pending'
                                      ? Colors.orange[600]
                                      : Colors.red[600],
                            ),
                          ),
                        ),
                      ),
                    ),
                    
                    const SizedBox(height: 20),
                    
                    // Status Text
                    FadeTransition(
                      opacity: _fadeAnimation,
                      child: Text(
                        status == 'completed' || status == 'success'
                            ? 'Transfer Successful'
                            : status == 'pending'
                                ? 'Transfer Pending'
                                : 'Transfer Failed',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    
                    const SizedBox(height: 12),
                    
                    // Amount
                    FadeTransition(
                      opacity: _fadeAnimation,
                      child: Text(
                        _formatCurrency(amount),
                        style: const TextStyle(
                          fontSize: 40,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: -1,
                        ),
                      ),
                    ),
                    
                    const SizedBox(height: 32),
                    
                    // Receipt Card
                    FadeTransition(
                      opacity: _fadeAnimation,
                      child: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 16),
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.1),
                              blurRadius: 20,
                              offset: const Offset(0, 10),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Transaction Details',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                            ),
                            const SizedBox(height: 20),
                            
                            // Status Badge
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: status == 'completed' || status == 'success'
                                    ? Colors.green.withOpacity(0.1)
                                    : status == 'pending'
                                        ? Colors.orange.withOpacity(0.1)
                                        : Colors.red.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                status.toUpperCase(),
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: status == 'completed' || status == 'success'
                                      ? Colors.green[700]
                                      : status == 'pending'
                                          ? Colors.orange[700]
                                          : Colors.red[700],
                                ),
                              ),
                            ),
                            
                            const SizedBox(height: 20),
                            const Divider(),
                            const SizedBox(height: 16),
                            
                            // Sender Details
                            _buildSection(
                              'Sender Information',
                              [
                                _buildDetailRow(
                                  'Name',
                                  payerName,
                                  isDark,
                                ),
                                _buildDetailRow(
                                  'Account Number',
                                  payerAccountNumber,
                                  isDark,
                                ),
                              ],
                              isDark,
                            ),
                            
                            const SizedBox(height: 20),
                            const Divider(),
                            const SizedBox(height: 16),
                            
                            // Recipient Details
                            _buildSection(
                              'Recipient Information',
                              [
                                _buildDetailRow(
                                  'Name',
                                  payeeName,
                                  isDark,
                                ),
                                _buildDetailRow(
                                  'Account Number',
                                  payeeAccountNumber,
                                  isDark,
                                ),
                              ],
                              isDark,
                            ),
                            
                            const SizedBox(height: 20),
                            const Divider(),
                            const SizedBox(height: 16),
                            
                            // Transaction Info
                            _buildSection(
                              'Transaction Information',
                              [
                                _buildDetailRow('Amount', _formatCurrency(amount), isDark),
                                _buildDetailRow('Description', note, isDark),
                                _buildDetailRow('Date', _formatDate(completedAt ?? createdAt), isDark),
                                _buildDetailRow('Reference', transactionId, isDark, isCopyable: true),
                              ],
                              isDark,
                            ),
                          ],
                        ),
                      ),
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Action Buttons
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        children: [
                          SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: ElevatedButton.icon(
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Download feature coming soon'),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.download),
                              label: const Text('Download Receipt'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: primaryColor,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                elevation: 2,
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: OutlinedButton.icon(
                              onPressed: () {
                                // Share functionality
                                Clipboard.setData(ClipboardData(text: transactionId));
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Reference copied to clipboard'),
                                    duration: Duration(seconds: 2),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.share),
                              label: const Text('Share Receipt'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: primaryColor,
                                side: BorderSide(color: primaryColor),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: TextButton(
                              onPressed: () => Navigator.pop(context),
                              child: Text(
                                'Close',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: isDark ? Colors.grey[400] : Colors.grey[700],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    
                    const SizedBox(height: 32),
                  ],
                ),
              ),
              
              // Close button at top
              Positioned(
                top: 16,
                right: 16,
                child: IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: Colors.white),
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.white24,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _parseColor(String colorString) {
    try {
      return Theme.of( context).colorScheme.primary;
    } catch (e) {
      // Fallback to default blue color
      return const Color(0xFF1A73E8);
    }
  }

  Widget _buildSection(String title, List<Widget> children, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.grey[400] : Colors.grey[600],
          ),
        ),
        const SizedBox(height: 12),
        ...children,
      ],
    );
  }

  Widget _buildDetailRow(String label, String value, bool isDark, {bool isCopyable = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              color: isDark ? Colors.grey[500] : Colors.grey[600],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Flexible(
                  child: Text(
                    value,
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ),
                if (isCopyable) ...[
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: value));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Copied to clipboard'),
                          duration: Duration(seconds: 1),
                        ),
                      );
                    },
                    child: Icon(
                      Icons.copy,
                      size: 16,
                      color: isDark ? Colors.grey[500] : Colors.grey[600],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
