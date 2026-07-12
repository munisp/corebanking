import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../../config/app_theme.dart';
import '../../../providers/dispute_provider.dart';
import '../../../models/dispute.dart';

class DisputeDetailsScreen extends StatefulWidget {
  final Dispute dispute;

  const DisputeDetailsScreen({super.key, required this.dispute});

  @override
  State<DisputeDetailsScreen> createState() => _DisputeDetailsScreenState();
}

class _DisputeDetailsScreenState extends State<DisputeDetailsScreen> {
  late Dispute _dispute;
  final _commentController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _dispute = widget.dispute;
    _loadDisputeDetails();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _loadDisputeDetails() async {
    final provider = context.read<DisputeProvider>();
    await provider.fetchDisputeById(_dispute.id);
    await provider.fetchDisputeComments(_dispute.id);
    
    if (provider.selectedDispute != null) {
      setState(() {
        _dispute = provider.selectedDispute!;
      });
    }
  }

  Future<void> _addComment() async {
    if (_commentController.text.trim().isEmpty) {
      return;
    }

    final provider = context.read<DisputeProvider>();
    final success = await provider.addComment(
      disputeId: _dispute.id,
      comment: _commentController.text.trim(),
    );

    if (!mounted) return;

    if (success) {
      _commentController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Comment added successfully'),
          backgroundColor: AppTheme.successColor,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.errorMessage ?? 'Failed to add comment'),
          backgroundColor: AppTheme.errorColor,
        ),
      );
    }
  }

  Future<void> _escalateDispute() async {
    final reasonController = TextEditingController();

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Escalate Dispute'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Are you sure you want to escalate this dispute?'),
            const SizedBox(height: 16),
            TextField(
              controller: reasonController,
              decoration: InputDecoration(
                labelText: 'Reason (Optional)',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              maxLines: 3,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.deepOrange,
            ),
            child: const Text('Escalate'),
          ),
        ],
      ),
    );

    if (result == true) {
      final provider = context.read<DisputeProvider>();
      final success = await provider.escalateDispute(
        _dispute.id,
        reason: reasonController.text.trim().isEmpty ? null : reasonController.text.trim(),
      );

      if (!mounted) return;

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Dispute escalated successfully'),
            backgroundColor: AppTheme.successColor,
          ),
        );
        _loadDisputeDetails();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(provider.errorMessage ?? 'Failed to escalate dispute'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    }
  }

  Future<void> _cancelDispute() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel Dispute'),
        content: const Text('Are you sure you want to cancel this dispute? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('No'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorColor,
            ),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final provider = context.read<DisputeProvider>();
      final success = await provider.cancelDispute(_dispute.id);

      if (!mounted) return;

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Dispute cancelled'),
            backgroundColor: AppTheme.successColor,
          ),
        );
        Navigator.pop(context, true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(provider.errorMessage ?? 'Failed to cancel dispute'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    }
  }

  Future<void> _deleteDispute() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Dispute'),
        content: const Text(
          'Are you sure you want to delete this dispute? '
          'This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorColor,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final provider = context.read<DisputeProvider>();
      final success = await provider.deleteDispute(_dispute.id);

      if (!mounted) return;

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Dispute deleted'),
            backgroundColor: AppTheme.successColor,
          ),
        );
        Navigator.pop(context, true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(provider.errorMessage ?? 'Failed to delete dispute'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    }
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return AppTheme.warningColor;
      case 'under_review':
        return Colors.blue;
      case 'resolved':
        return AppTheme.successColor;
      case 'rejected':
        return AppTheme.errorColor;
      case 'escalated':
        return Colors.deepOrange;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 2);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dispute Details'),
        elevation: 0,
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) {
              switch (value) {
                case 'delete':
                  _deleteDispute();
                  break;
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'delete',
                child: Row(
                  children: [
                    Icon(Icons.delete, color: AppTheme.errorColor),
                    SizedBox(width: 8),
                    Text('Delete Dispute'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Consumer<DisputeProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          return SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header card with status
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: _getStatusColor(_dispute.status).withOpacity(0.1),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.gavel,
                            size: 32,
                            color: _getStatusColor(_dispute.status),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _dispute.statusDisplay,
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    color: _getStatusColor(_dispute.status),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Dispute ID: ${_dispute.id}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: AppTheme.getTextSecondary(context),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        _dispute.subject,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Amount: ${currencyFormat.format(_dispute.disputedAmount)}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),

                // Details section
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Dispute Information',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.getTextPrimary(context),
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildDetailRow('Category', _dispute.categoryDisplay, Icons.category),
                      _buildDetailRow('Transaction ID', _dispute.transactionId, Icons.receipt_long),
                      _buildDetailRow('Priority', _dispute.priority.toUpperCase(), Icons.priority_high),
                      _buildDetailRow(
                        'Created',
                        DateFormat('MMMM dd, yyyy hh:mm a').format(_dispute.createdAt),
                        Icons.calendar_today,
                      ),
                      if (_dispute.updatedAt != null)
                        _buildDetailRow(
                          'Last Updated',
                          DateFormat('MMMM dd, yyyy hh:mm a').format(_dispute.updatedAt!),
                          Icons.update,
                        ),
                      if (_dispute.resolvedAt != null)
                        _buildDetailRow(
                          'Resolved',
                          DateFormat('MMMM dd, yyyy hh:mm a').format(_dispute.resolvedAt!),
                          Icons.check_circle,
                        ),
                    ],
                  ),
                ),

                const Divider(),

                // Description
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Description',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.getTextPrimary(context),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _dispute.description,
                        style: TextStyle(
                          fontSize: 14,
                          color: AppTheme.getTextSecondary(context),
                        ),
                      ),
                    ],
                  ),
                ),

                // Resolution notes (if resolved/rejected)
                if (_dispute.resolutionNotes != null) ...[
                  const Divider(),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Resolution Notes',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.getTextPrimary(context),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: _getStatusColor(_dispute.status).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: _getStatusColor(_dispute.status).withOpacity(0.3),
                            ),
                          ),
                          child: Text(
                            _dispute.resolutionNotes!,
                            style: TextStyle(
                              fontSize: 14,
                              color: AppTheme.getTextSecondary(context),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const Divider(),

                // Comments section
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Comments & Updates',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.getTextPrimary(context),
                        ),
                      ),
                      const SizedBox(height: 16),
                      
                      // Comments list
                      if (provider.isLoadingComments)
                        const Center(child: CircularProgressIndicator())
                      else if (provider.comments.isEmpty)
                        Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              'No comments yet',
                              style: TextStyle(
                                color: AppTheme.getTextSecondary(context),
                              ),
                            ),
                          ),
                        )
                      else
                        ...provider.comments.map((comment) {
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      CircleAvatar(
                                        radius: 16,
                                        backgroundColor: AppTheme.primaryColor,
                                        child: Text(
                                          (comment['user_name'] ?? 'U')[0].toUpperCase(),
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              comment['user_name'] ?? 'User',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                            Text(
                                              DateFormat('MMM dd, yyyy hh:mm a').format(
                                                DateTime.parse(comment['created_at'] ?? DateTime.now().toIso8601String()),
                                              ),
                                              style: TextStyle(
                                                fontSize: 11,
                                                color: AppTheme.getTextSecondary(context),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    comment['comment'] ?? '',
                                    style: const TextStyle(fontSize: 14),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }),

                      const SizedBox(height: 16),

                      // Add comment field
                      if (!_dispute.isResolved && !_dispute.isRejected)
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _commentController,
                                decoration: InputDecoration(
                                  hintText: 'Add a comment...',
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                                maxLines: 2,
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              onPressed: provider.isProcessing ? null : _addComment,
                              icon: const Icon(Icons.send),
                              color: AppTheme.primaryColor,
                              iconSize: 28,
                            ),
                          ],
                        ),
                    ],
                  ),
                ),

                // Action buttons
                if (!_dispute.isResolved && !_dispute.isRejected)
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        if (_dispute.isPending || _dispute.isUnderReview)
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: _escalateDispute,
                              icon: const Icon(Icons.priority_high),
                              label: const Text('Escalate Dispute'),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                foregroundColor: Colors.deepOrange,
                              ),
                            ),
                          ),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: _cancelDispute,
                            icon: const Icon(Icons.cancel),
                            label: const Text('Cancel Dispute'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              foregroundColor: AppTheme.errorColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 24),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppTheme.getTextSecondary(context)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppTheme.getTextSecondary(context),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.getTextPrimary(context),
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
