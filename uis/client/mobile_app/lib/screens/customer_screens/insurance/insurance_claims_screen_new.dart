import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../models/insurance_claim.dart';
import '../../../services/insurance_service.dart';
import '../../../services/error_handler_service.dart';
import 'submit_claim_screen.dart';

class InsuranceClaimsScreenNew extends StatefulWidget {
  const InsuranceClaimsScreenNew({super.key});

  @override
  State<InsuranceClaimsScreenNew> createState() => _InsuranceClaimsScreenNewState();
}

class _InsuranceClaimsScreenNewState extends State<InsuranceClaimsScreenNew> {
  final InsuranceService _insuranceService = InsuranceService();
  
  bool _isLoading = true;
  String? _errorMessage;
  List<InsuranceClaim> _claims = [];

  @override
  void initState() {
    super.initState();
    _loadClaims();
  }

  Future<void> _loadClaims() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final claims = await _insuranceService.getAllClaims();
      setState(() {
        _claims = claims;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = ErrorHandlerService.handleError(e);
        _isLoading = false;
      });
    }
  }

  String _formatDate(DateTime date) {
    return DateFormat('MMM dd, yyyy').format(date);
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
        return Colors.green;
      case 'pending':
        return Colors.orange;
      case 'rejected':
        return Colors.red;
      case 'processing':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
        return Icons.check_circle;
      case 'pending':
        return Icons.schedule;
      case 'rejected':
        return Icons.cancel;
      case 'processing':
        return Icons.pending;
      default:
        return Icons.info;
    }
  }

  void _showClaimDetails(InsuranceClaim claim) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Claim #${claim.id}'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildDetailRow('Claim ID', claim.id),
              _buildDetailRow('Policy ID', claim.policyId),
              _buildDetailRow('Amount', '₦${NumberFormat('#,###').format(claim.claimAmount)}'),
              _buildDetailRow('Status', claim.status.toUpperCase()),
              _buildDetailRow('Incident Date', _formatDate(claim.incidentDate)),
              _buildDetailRow('Filed Date', _formatDate(claim.createdAt)),
              if (claim.approvalDate != null)
                _buildDetailRow('Approval Date', _formatDate(claim.approvalDate!)),
              if (claim.rejectionReason != null && claim.rejectionReason!.isNotEmpty)
                _buildDetailRow('Rejection Reason', claim.rejectionReason!),
              const SizedBox(height: 12),
              const Text(
                'Incident Description:',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 8),
              Text(claim.incidentDescription),
              if (claim.supportingDocuments.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text(
                  'Supporting Documents:',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 8),
                ...claim.supportingDocuments.map(
                  (doc) => Padding(
                    padding: const EdgeInsets.only(left: 8, bottom: 4),
                    child: Row(
                      children: [
                        const Icon(Icons.attach_file, size: 16),
                        const SizedBox(width: 4),
                        Expanded(child: Text(doc)),
                      ],
                    ),
                  ),
                ),
              ],
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
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w500,
                color: Colors.grey[700],
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

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
                        onPressed: _loadClaims,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _claims.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.file_copy, size: 80, color: Colors.grey[400]),
                          const SizedBox(height: 16),
                          Text(
                            'No claims yet',
                            style: TextStyle(fontSize: 18, color: Colors.grey[600]),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Submit a claim to get started',
                            style: TextStyle(fontSize: 14, color: Colors.grey[500]),
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton.icon(
                            onPressed: () async {
                              await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => const SubmitClaimScreen(),
                                ),
                              );
                              _loadClaims();
                            },
                            icon: const Icon(Icons.add),
                            label: const Text('Submit Claim'),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadClaims,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _claims.length,
                        itemBuilder: (context, index) {
                          final claim = _claims[index];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            elevation: 2,
                            child: InkWell(
                              onTap: () => _showClaimDetails(claim),
                              borderRadius: BorderRadius.circular(12),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        CircleAvatar(
                                          backgroundColor: _getStatusColor(claim.status).withOpacity(0.1),
                                          child: Icon(
                                            _getStatusIcon(claim.status),
                                            color: _getStatusColor(claim.status),
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                'Claim #${claim.id}',
                                                style: const TextStyle(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                              Text(
                                                'Policy: ${claim.policyId}',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: Colors.grey[600],
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ],
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                          decoration: BoxDecoration(
                                            color: _getStatusColor(claim.status).withOpacity(0.1),
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(
                                              color: _getStatusColor(claim.status),
                                              width: 1,
                                            ),
                                          ),
                                          child: Text(
                                            claim.status.toUpperCase(),
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.bold,
                                              color: _getStatusColor(claim.status),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    Text(
                                      claim.incidentDescription,
                                      style: TextStyle(
                                        fontSize: 14,
                                        color: Colors.grey[700],
                                      ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 12),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: _buildInfoColumn(
                                            'Amount',
                                            '₦${NumberFormat('#,###').format(claim.claimAmount)}',
                                          ),
                                        ),
                                        Expanded(
                                          child: _buildInfoColumn(
                                            'Incident Date',
                                            _formatDate(claim.incidentDate),
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
      floatingActionButton: _claims.isNotEmpty
          ? FloatingActionButton.extended(
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const SubmitClaimScreen(),
                  ),
                );
                _loadClaims();
              },
              icon: const Icon(Icons.add),
              label: const Text('Submit Claim'),
            )
          : null,
    );
  }

  Widget _buildInfoColumn(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey[600],
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
