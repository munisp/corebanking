import 'package:flutter/material.dart';
import '../../../models/insurance_policy.dart';
import '../../../services/insurance_service.dart';
import '../../../services/error_handler_service.dart';
import 'package:intl/intl.dart';



class InsurancePoliciesScreen extends StatefulWidget {
  const InsurancePoliciesScreen({super.key});

  @override
  State<InsurancePoliciesScreen> createState() => _InsurancePoliciesScreenState();
}

class _InsurancePoliciesScreenState extends State<InsurancePoliciesScreen> {
  final InsuranceService _insuranceService = InsuranceService();
  
  bool _isLoading = true;
  String? _errorMessage;
  List<InsurancePolicy> _policies = [];

  @override
  void initState() {
    super.initState();
    _loadPolicies();
  }

  Future<void> _loadPolicies() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final policies = await _insuranceService.getCustomerPolicies();
      setState(() {
        _policies = policies;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = ErrorHandlerService.handleError(e);
        _isLoading = false;
      });
    }
  }

  Future<void> _viewPolicyDetails(String policyId) async {
    try {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(child: CircularProgressIndicator()),
      );

      final policy = await _insuranceService.getPolicyById(policyId);
      final claims = await _insuranceService.getClaimsByPolicyId(policyId);
      
      if (!mounted) return;
      Navigator.pop(context);

      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(_insuranceService.getPolicyTypeDisplayName(policy.policyType)),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Policy Details Section
                  const Text(
                    'Policy Details',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _buildInfoRow('Policy ID', policy.id),
                  _buildInfoRow('Coverage', '₦${policy.coverageAmount.toStringAsFixed(2)}'),
                  _buildInfoRow('Premium', '₦${policy.premium.toStringAsFixed(2)}'),
                  _buildInfoRow('Duration', '${policy.durationMonths} months'),
                  _buildInfoRow('Status', policy.status.toUpperCase()),
                  _buildInfoRow('Start Date', _formatDate(policy.startDate)),
                  _buildInfoRow('Expiry Date', _formatDate(policy.expiryDate)),
                  if (policy.nextPaymentDate != null)
                    _buildInfoRow('Next Payment', _formatDate(policy.nextPaymentDate!)),
                  if (policy.beneficiaries.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    const Text(
                      'Beneficiaries:',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    ...policy.beneficiaries.map((b) => Text('• $b')),
                  ],
                  
                  // Claims Section
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Claims',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        '${claims.length} ${claims.length == 1 ? 'claim' : 'claims'}',
                        style: TextStyle(
                          color: Colors.grey[600],
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  
                  if (claims.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 16),
                      child: Center(
                        child: Text(
                          'No claims filed for this policy',
                          style: TextStyle(
                            color: Colors.grey,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ),
                    )
                  else
                    ...claims.map((claim) => Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 4,
                        ),
                        leading: CircleAvatar(
                          backgroundColor: _getClaimStatusColor(claim.status),
                          child: Icon(
                            _getClaimStatusIcon(claim.status),
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                        title: Text(
                          'Claim #${claim.id.length > 8 ? claim.id.substring(0, 8) : claim.id}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('₦${claim.claimAmount.toStringAsFixed(2)}'),
                            Text(
                              _formatDate(claim.incidentDate),
                              style: const TextStyle(fontSize: 12),
                            ),
                          ],
                        ),
                        trailing: Chip(
                          label: Text(
                            claim.status.toUpperCase(),
                            style: const TextStyle(fontSize: 11),
                          ),
                          backgroundColor: _getClaimStatusColor(claim.status).withOpacity(0.2),
                          labelStyle: TextStyle(
                            color: _getClaimStatusColor(claim.status),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        onTap: () => _viewClaimDetails(claim.id),
                      ),
                    )),
                ],
              ),
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
      Navigator.pop(context);
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ErrorHandlerService.handleError(e)),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _viewClaimDetails(String claimId) async {
    try {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(child: CircularProgressIndicator()),
      );

      final claim = await _insuranceService.getClaimById(claimId);
      
      if (!mounted) return;
      Navigator.pop(context);

      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Claim #${claim.id.length > 8 ? claim.id.substring(0, 8) : claim.id}'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildInfoRow('Claim ID', claim.id),
                _buildInfoRow('Policy ID', claim.policyId),
                _buildInfoRow('Amount', '₦${claim.claimAmount.toStringAsFixed(2)}'),
                _buildInfoRow('Status', claim.status.toUpperCase()),
                _buildInfoRow('Incident Date', _formatDate(claim.incidentDate)),
                _buildInfoRow('Filed Date', _formatDate(claim.createdAt)),
                if (claim.approvalDate != null)
                  _buildInfoRow('Approval Date', _formatDate(claim.approvalDate!)),
                if (claim.rejectionReason != null && claim.rejectionReason!.isNotEmpty)
                  _buildInfoRow('Rejection Reason', claim.rejectionReason!),
                if (claim.incidentDescription.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'Incident Description:',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(claim.incidentDescription),
                ],
                if (claim.supportingDocuments.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'Supporting Documents:',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  ...claim.supportingDocuments.map((doc) => Padding(
                    padding: const EdgeInsets.only(left: 8, top: 4),
                    child: Row(
                      children: [
                        const Icon(Icons.attach_file, size: 16),
                        const SizedBox(width: 4),
                        Expanded(child: Text(doc)),
                      ],
                    ),
                  )),
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
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context);
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ErrorHandlerService.handleError(e)),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  String _formatDate(DateTime date) {
    return DateFormat('MMM dd, yyyy').format(date);
  }

  Color _getClaimStatusColor(String status) {
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

  IconData _getClaimStatusIcon(String status) {
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

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'active':
        return Colors.green;
      case 'pending':
        return Colors.orange;
      case 'expired':
        return Colors.red;
      case 'cancelled':
        return Colors.grey;
      default:
        return Colors.blue;
    }
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
                        onPressed: _loadPolicies,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _policies.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.policy, size: 60, color: Colors.grey),
                          SizedBox(height: 16),
                          Text(
                            'No insurance policies yet',
                            style: TextStyle(fontSize: 16, color: Colors.grey),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadPolicies,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _policies.length,
                        itemBuilder: (context, index) {
                          final policy = _policies[index];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 16),
                            child: InkWell(
                              onTap: () => _viewPolicyDetails(policy.id),
                              borderRadius: BorderRadius.circular(12),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          _insuranceService.getPolicyIcon(policy.policyType),
                                          style: const TextStyle(fontSize: 32),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                _insuranceService.getPolicyTypeDisplayName(policy.policyType),
                                                style: const TextStyle(
                                                  fontSize: 18,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                'Policy ID: ${policy.id.length > 12 ? '${policy.id.substring(0, 12)}...' : policy.id}',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: Colors.grey[600],
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 8,
                                            vertical: 4,
                                          ),
                                          decoration: BoxDecoration(
                                            color: _getStatusColor(policy.status).withOpacity(0.2),
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          child: Text(
                                            policy.status.toUpperCase(),
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                              color: _getStatusColor(policy.status),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 16),
                                    const Divider(),
                                    const SizedBox(height: 8),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'Coverage',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: Colors.grey[600],
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              '₦${policy.coverageAmount.toStringAsFixed(0)}',
                                              style: const TextStyle(
                                                fontSize: 18,
                                                fontWeight: FontWeight.bold,
                                                color: Colors.white,
                                              ),
                                            ),
                                          ],
                                        ),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            Text(
                                              'Premium',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: Colors.grey[600],
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              '₦${policy.premium.toStringAsFixed(2)}/mo',
                                              style: const TextStyle(
                                                fontSize: 16,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    Row(
                                      children: [
                                        Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                                        const SizedBox(width: 4),
                                        Text(
                                          'Expires: ${_formatDate(policy.expiryDate)}',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: Colors.grey[600],
                                          ),
                                        ),
                                        if (policy.nextPaymentDate != null) ...[
                                          const SizedBox(width: 16),
                                          Icon(Icons.payment, size: 14, color: Colors.grey[600]),
                                          const SizedBox(width: 4),
                                          Text(
                                            'Next: ${_formatDate(policy.nextPaymentDate!)}',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.grey[600],
                                            ),
                                          ),
                                        ],
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
