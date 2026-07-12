import 'package:flutter/material.dart';
import '../../../models/escrow.dart';
import '../../../services/escrow_service.dart';
import '../../../utils/error_helper.dart';
import 'package:intl/intl.dart';

class EscrowDetailsScreen extends StatefulWidget {
  final Escrow escrow;
  const EscrowDetailsScreen({super.key, required this.escrow});

  @override
  State<EscrowDetailsScreen> createState() => _EscrowDetailsScreenState();
}

class _EscrowDetailsScreenState extends State<EscrowDetailsScreen> {
  bool _isFunding = false;
  bool _isActioning = false;

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'awaiting_funding':
        return Colors.orange;
      case 'funded':
        return Colors.blue;
      case 'released':
      case 'completed':
        return Colors.green;
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'awaiting_funding':
        return Icons.hourglass_bottom;
      case 'funded':
        return Icons.account_balance_wallet_outlined;
      case 'released':
      case 'completed':
        return Icons.check_circle_outline;
      case 'cancelled':
        return Icons.cancel_outlined;
      default:
        return Icons.info_outline;
    }
  }

  /// =========================
  /// FUND ESCROW (AMOUNT + PIN)
  /// =========================
  Future<void> _fundEscrow() async {
    final amountController = TextEditingController();
    final pinController = TextEditingController();

    double? amount;
    String? pin;

    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Fund Escrow"),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: amountController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: "Amount",
                prefixText: "₦ ",
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: pinController,
              obscureText: true,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: "Transaction PIN",
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Cancel"),
          ),
          FilledButton(
            onPressed: () {
              amount = double.tryParse(amountController.text);
              pin = pinController.text;

              if (amount == null || amount! <= 0 || pin == null || pin!.isEmpty) {
                return;
              }

              Navigator.pop(context);
            },
            child: const Text("Fund"),
          ),
        ],
      ),
    );

    if (amount == null || pin == null) return;

    setState(() => _isFunding = true);

    try {
      await EscrowService.instance.fundContract(
        widget.escrow.id,
        amount!,
        'wallet',
        pin!,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Escrow funded successfully"),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ErrorHelper.handleAndShow(context, e, showErrorCode: true);
      }
    } finally {
      if (mounted) setState(() => _isFunding = false);
    }
  }

  /// =========================
  /// RELEASE ESCROW
  /// =========================
  Future<void> _releaseEscrow() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Release Funds'),
        content: const Text(
            'Are you sure you want to release funds? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Release'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isActioning = true);

    try {
      await EscrowService.instance.releaseContract(widget.escrow.id, '');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Funds released successfully'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ErrorHelper.handleAndShow(context, e, showErrorCode: true);
      }
    } finally {
      if (mounted) setState(() => _isActioning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final escrow = widget.escrow;
    final currencyFormat =
        NumberFormat.currency(symbol: '₦', decimalDigits: 2);

    final status = escrow.status.toLowerCase();

    /// =========================
    /// ACTION RULES (BACKEND DRIVEN)
    /// =========================
    final canFund = status == 'awaiting_funding';
    final canRelease = status == 'funded';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Escrow Details'),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            /// HEADER
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Theme.of(context).primaryColor,
                    Theme.of(context).primaryColor.withOpacity(0.8),
                  ],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    escrow.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    currencyFormat.format(escrow.amount),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: _getStatusColor(status),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      status.toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                      ),
                    ),
                  )
                ],
              ),
            ),

            const SizedBox(height: 16),

            /// DETAILS (PRESERVED FULLY)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Card(
                    child: ListTile(
                      title: const Text("Contract ID"),
                      subtitle: Text(escrow.id),
                    ),
                  ),
                  Card(
                    child: ListTile(
                      title: const Text("Buyer"),
                      subtitle: Text(escrow.buyerName),
                    ),
                  ),
                  Card(
                    child: ListTile(
                      title: const Text("Seller"),
                      subtitle: Text(escrow.sellerName),
                    ),
                  ),
                  Card(
                    child: ListTile(
                      title: const Text("Created"),
                      subtitle:
                          Text(DateFormat('yyyy-MM-dd').format(escrow.createdAt)),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            /// ACTION BUTTONS
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  if (canFund)
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: FilledButton.icon(
                        onPressed: _isFunding ? null : _fundEscrow,
                        icon: const Icon(Icons.account_balance_wallet),
                        label: Text(_isFunding ? "Processing..." : "Fund Escrow"),
                      ),
                    ),

                  if (canRelease) ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.green,
                        ),
                        onPressed: _isActioning ? null : _releaseEscrow,
                        icon: const Icon(Icons.check_circle),
                        label: const Text("Release Funds"),
                      ),
                    ),
                  ],
                ],
              ),
            )
          ],
        ),
      ),
    );
  }
}