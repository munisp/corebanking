import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../models/etherisc_policy.dart';
import '../../../services/insurance_service.dart';
import '../../../services/error_handler_service.dart';
import '../../../config/app_theme.dart';
import 'apply_policy_screen.dart';

class AllPoliciesScreen extends StatefulWidget {
  const AllPoliciesScreen({super.key});

  @override
  State<AllPoliciesScreen> createState() => _AllPoliciesScreenState();
}

class _AllPoliciesScreenState extends State<AllPoliciesScreen> {
  final InsuranceService _insuranceService = InsuranceService();
  
  bool _isLoading = true;
  String? _errorMessage;
  List<EtheriscPolicy> _policies = [];
  String? _selectedFilter;

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
      final policies = await _insuranceService.getAllEtheriscPolicies();
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

  List<EtheriscPolicy> get _filteredPolicies {
    if (_selectedFilter == null || _selectedFilter == 'all') {
      return _policies;
    }
    return _policies.where((p) => p.insuranceType.toLowerCase().contains(_selectedFilter!)).toList();
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'active':
        return Colors.green;
      case 'expired':
        return Colors.red;
      case 'pending':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  IconData _getPolicyIcon(String insuranceType) {
    switch (insuranceType.toLowerCase()) {
      case 'crop_weather':
        return Icons.agriculture;
      case 'flight_delay':
        return Icons.flight;
      case 'health':
        return Icons.local_hospital;
      case 'life':
        return Icons.favorite;
      case 'auto':
        return Icons.directions_car;
      case 'travel':
        return Icons.luggage;
      default:
        return Icons.description;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          // Filter chips
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterChip('All', null),
                  const SizedBox(width: 8),
                  _buildFilterChip('Crop Weather', 'crop_weather'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Flight Delay', 'flight_delay'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Health', 'health'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Life', 'life'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Auto', 'auto'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Travel', 'travel'),
                ],
              ),
            ),
          ),
          
          // Policies list
          Expanded(
            child: _isLoading
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
                              style: const TextStyle(color: Colors.red),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              onPressed: _loadPolicies,
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      )
                    : _filteredPolicies.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.policy_outlined,
                                  size: 80,
                                  color: Colors.grey[400],
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  _selectedFilter == 'all'
                                      ? 'No policies available'
                                      : 'No $_selectedFilter policies available',
                                  style: TextStyle(
                                    fontSize: 18,
                                    color: Colors.grey[600],
                                  ),
                                ),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _loadPolicies,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: _filteredPolicies.length,
                              itemBuilder: (context, index) {
                                final policy = _filteredPolicies[index];
                                return _buildPolicyCard(policy);
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String? value) {
    final isSelected = _selectedFilter == value;
    return FilterChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        setState(() {
          _selectedFilter = value;
        });
      },
      backgroundColor: Colors.grey[200],
      selectedColor: AppTheme.primaryColor.withOpacity(0.2),
      checkmarkColor: AppTheme.primaryColor,
      labelStyle: TextStyle(
        color: isSelected ? AppTheme.primaryColor : Colors.black87,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
      ),
    );
  }

  Widget _buildPolicyCard(EtheriscPolicy policy) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      child: InkWell(
        onTap: () => _showPolicyDetails(policy),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
                    child: Icon(
                      _getPolicyIcon(policy.insuranceType),
                      color: AppTheme.primaryColor,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          policy.displayName,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'Template ID: ${policy.policyId}',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: _getStatusColor(policy.status).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _getStatusColor(policy.status),
                        width: 1,
                      ),
                    ),
                    child: Text(
                      policy.status.toUpperCase(),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: _getStatusColor(policy.status),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _buildInfoColumn(
                      'Coverage',
                      '₦${NumberFormat('#,###').format(policy.coverageAmount)}',
                    ),
                  ),
                  Expanded(
                    child: _buildInfoColumn(
                      'Premium',
                      '₦${NumberFormat('#,###').format(policy.premiumAmount)}',
                    ),
                  ),
                  Expanded(
                    child: _buildInfoColumn(
                      'Duration',
                      '${policy.durationDays} days',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => ApplyPolicyScreen(
                        selectedTemplate: policy,
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.add_circle_outline, size: 18),
                label: const Text('Apply for this Policy'),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 36),
                ),
              ),
            ],
          ),
        ),
      ),
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
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  void _showPolicyDetails(EtheriscPolicy policy) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(policy.displayName),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildDetailRow('Template ID', policy.policyId),
              _buildDetailRow('Insurance Type', policy.insuranceType),
              _buildDetailRow('Coverage Amount', '₦${NumberFormat('#,###').format(policy.coverageAmount)}'),
              _buildDetailRow('Premium', '₦${NumberFormat('#,###').format(policy.premiumAmount)}'),
              _buildDetailRow('Duration', '${policy.durationDays} days (~${policy.durationMonths} months)'),
              _buildDetailRow('Status', policy.status.toUpperCase()),
              if (policy.triggerConditions.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text(
                  'Trigger Conditions:',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 8),
                ...policy.triggerConditions.entries.map(
                  (e) => Padding(
                    padding: const EdgeInsets.only(left: 8, bottom: 4),
                    child: Text('• ${e.key}: ${e.value}'),
                  ),
                ),
              ],
              if (policy.smartContractAddress != null) ...[
                const SizedBox(height: 12),
                _buildDetailRow('Smart Contract', policy.smartContractAddress!),
              ],
              if (policy.blockchainTxHash != null) ...[
                _buildDetailRow('Blockchain TX', '${policy.blockchainTxHash!.substring(0, 20)}...'),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => ApplyPolicyScreen(
                    selectedTemplate: policy,
                  ),
                ),
              );
            },
            child: const Text(
              'Apply Now',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
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
}
