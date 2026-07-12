import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../models/trade_finance.dart';
import '../../../config/app_theme.dart';

class LCDetailsScreen extends StatelessWidget {
  final LetterOfCredit lc;

  const LCDetailsScreen({super.key, required this.lc});

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'issued':
        return Colors.blue;
      case 'confirmed':
        return Colors.green;
      case 'draft':
        return Colors.orange;
      case 'amended':
        return Colors.purple;
      case 'expired':
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _formatAmount(double amount, String currency) {
    final format = NumberFormat('#,##0.00');
    return '$currency ${format.format(amount)}';
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _statusColor(lc.status);

    return Scaffold(
      appBar: AppBar(
        title: const Text('LC Details', style: TextStyle(fontWeight: FontWeight.bold)),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    statusColor.withOpacity(0.15),
                    statusColor.withOpacity(0.05),
                  ],
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: statusColor.withOpacity(0.3)),
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.article_rounded,
                        color: statusColor, size: 36),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    lc.beneficiaryName.isNotEmpty
                        ? lc.beneficiaryName
                        : 'Letter of Credit',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.getTextPrimary(context),
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _formatAmount(lc.amount, lc.currency),
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: statusColor,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20),
                      border:
                          Border.all(color: statusColor.withOpacity(0.4)),
                    ),
                    child: Text(
                      lc.status.toUpperCase(),
                      style: TextStyle(
                        color: statusColor,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // LC Reference Details
            _SectionCard(
              title: 'LC Reference',
              icon: Icons.tag_rounded,
              children: [
                if (lc.lcRef.isNotEmpty)
                  _DetailRow('LC Reference', lc.lcRef, monospace: true),
                if (lc.swiftRef.isNotEmpty)
                  _DetailRow('SWIFT Ref', lc.swiftRef, monospace: true),
                _DetailRow('ID', lc.id, monospace: true),
                _DetailRow('Type', _capitalise(lc.type)),
              ],
            ),
            const SizedBox(height: 16),

            // Parties
            _SectionCard(
              title: 'Parties',
              icon: Icons.people_outline_rounded,
              children: [
                _DetailRow('Applicant ID', lc.applicantId, monospace: true),
                _DetailRow('Beneficiary', lc.beneficiaryName),
                if (lc.beneficiaryCountry.isNotEmpty)
                  _DetailRow('Beneficiary Country', lc.beneficiaryCountry),
              ],
            ),
            const SizedBox(height: 16),

            // Terms
            _SectionCard(
              title: 'Terms',
              icon: Icons.description_outlined,
              children: [
                _DetailRow('Currency', lc.currency),
                _DetailRow('Amount', _formatAmount(lc.amount, lc.currency),
                    highlight: true),
                if (lc.availableBy.isNotEmpty)
                  _DetailRow('Available By', lc.availableBy),
                if (lc.expiryDate.isNotEmpty)
                  _DetailRow('Expiry Date', lc.expiryDate),
                if (lc.placeOfExpiry.isNotEmpty)
                  _DetailRow('Place of Expiry', lc.placeOfExpiry),
              ],
            ),
            const SizedBox(height: 16),

            if (lc.goodsDescription.isNotEmpty) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.getCardBackground(context),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                      color: Theme.of(context).dividerColor.withOpacity(0.3)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.03),
                      blurRadius: 6,
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.inventory_2_outlined,
                            size: 16,
                            color: Theme.of(context).colorScheme.primary),
                        const SizedBox(width: 8),
                        Text('Goods Description',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                              color: AppTheme.getTextPrimary(context),
                            )),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      lc.goodsDescription,
                      style: TextStyle(
                        fontSize: 13,
                        color: AppTheme.getTextSecondary(context),
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Dates
            _SectionCard(
              title: 'Dates',
              icon: Icons.calendar_today_outlined,
              children: [
                if (lc.createdAt.isNotEmpty)
                  _DetailRow('Created', _formatDate(lc.createdAt)),
                if (lc.issuedAt != null)
                  _DetailRow('Issued', _formatDate(lc.issuedAt!)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _capitalise(String s) {
    if (s.isEmpty) return s;
    return s[0].toUpperCase() + s.substring(1).replaceAll('_', ' ');
  }

  String _formatDate(String date) {
    try {
      return DateFormat('MMM dd, yyyy').format(DateTime.parse(date));
    } catch (_) {
      return date;
    }
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.getCardBackground(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Theme.of(context).dividerColor.withOpacity(0.3),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Icon(icon,
                    size: 16,
                    color: Theme.of(context).colorScheme.primary),
                const SizedBox(width: 8),
                Text(title,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: AppTheme.getTextPrimary(context),
                    )),
              ],
            ),
          ),
          const Divider(height: 1),
          ...children,
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;
  final bool monospace;

  const _DetailRow(this.label, this.value,
      {this.highlight = false, this.monospace = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: Text(label,
                style: TextStyle(
                    fontSize: 13,
                    color: AppTheme.getTextSecondary(context))),
          ),
          Expanded(
            flex: 6,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight:
                    highlight ? FontWeight.w800 : FontWeight.w600,
                color: highlight
                    ? Theme.of(context).colorScheme.primary
                    : AppTheme.getTextPrimary(context),
                fontFamily: monospace ? 'monospace' : null,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}
