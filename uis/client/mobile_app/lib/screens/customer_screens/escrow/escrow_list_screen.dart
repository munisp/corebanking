import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../config/app_theme.dart';
import '../../../models/escrow.dart';
import '../../../services/escrow_service.dart';
import '../../../l10n/app_localizations.dart';
import 'create_escrow_screen.dart';
import 'escrow_details_screen.dart';

class EscrowListScreen extends StatefulWidget {
  const EscrowListScreen({super.key});

  @override
  State<EscrowListScreen> createState() => _EscrowListScreenState();
}

class _EscrowListScreenState extends State<EscrowListScreen> {
  bool _isLoading = false;
  List<Escrow> _escrows = [];

  @override
  void initState() {
    super.initState();
    _loadEscrows();
  }

  Future<void> _loadEscrows() async {
    setState(() => _isLoading = true);
    try {
      final escrows = await EscrowService.instance.listContracts();
      setState(() => _escrows = escrows);
    } catch (e) {
      // Optionally handle error, e.g. show snackbar
      setState(() => _escrows = []);
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleRefresh() async {
    await _loadEscrows();
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'active':
        return AppTheme.successColor;
      case 'pending':
        return AppTheme.warningColor;
      case 'completed':
        return AppTheme.primaryColor;
      case 'released':
        return Colors.blue;
      case 'cancelled':
        return AppTheme.errorColor;
      default:
        return Colors.grey;
    }
  }

  IconData _getTypeIcon(String type) {
    switch (type.toLowerCase()) {
      case 'property transaction':
        return Icons.home_outlined;
      case 'service payment':
        return Icons.handyman_outlined;
      case 'contract deposit':
        return Icons.description_outlined;
      default:
        return Icons.security_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 2);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.activeEscrows),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const CreateEscrowScreen(),
                ),
              ).then((_) => _loadEscrows());
            },
            tooltip: l10n.createEscrow,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _handleRefresh,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _escrows.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.security_outlined,
                          size: 64,
                          color: Colors.grey[400],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'No Active Escrows',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.getTextPrimary(context),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Create an escrow to secure your transactions',
                          style: TextStyle(
                            color: AppTheme.getTextSecondary(context),
                          ),
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton.icon(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => const CreateEscrowScreen(),
                              ),
                            ).then((_) => _loadEscrows());
                          },
                          icon: const Icon(Icons.add),
                          label: Text(l10n.createEscrow),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _escrows.length,
                    itemBuilder: (context, index) {
                      final escrow = _escrows[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 16),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                            color: AppTheme.getBorderColor(context),
                          ),
                        ),
                        child: InkWell(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => EscrowDetailsScreen(escrow: escrow),
                              ),
                            ).then((_) => _loadEscrows());
                          },
                          borderRadius: BorderRadius.circular(12),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: AppTheme.primaryColor
                                            .withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Icon(
                                        _getTypeIcon(escrow.type),
                                        color: Theme.of(context).colorScheme.primary,
                                        size: 24,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            escrow.title,
                                            style: TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.w600,
                                              color: AppTheme.getTextPrimary(
                                                  context),
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            escrow.type,
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: AppTheme.getTextSecondary(
                                                  context),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                        vertical: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _getStatusColor(escrow.status)
                                            .withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Text(
                                        escrow.status,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: _getStatusColor(escrow.status),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Amount',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: AppTheme.getTextSecondary(
                                                context),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          currencyFormat.format(escrow.amount),
                                          style: TextStyle(
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold,
                                            color: Theme.of(context).colorScheme.primary,
                                          ),
                                        ),
                                      ],
                                    ),
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          'Created',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: AppTheme.getTextSecondary(
                                                context),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          DateFormat('MMM dd, yyyy')
                                              .format(escrow.createdAt),
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w500,
                                            color: AppTheme.getTextPrimary(
                                                context),
                                          ),
                                        ),
                                      ],
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
    );
  }
}
