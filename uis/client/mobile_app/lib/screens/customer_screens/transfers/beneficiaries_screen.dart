import 'package:flutter/material.dart';
import '../../../config/app_theme.dart';

class BeneficiariesScreen extends StatefulWidget {
  const BeneficiariesScreen({super.key});

  @override
  State<BeneficiariesScreen> createState() => _BeneficiariesScreenState();
}

class _BeneficiariesScreenState extends State<BeneficiariesScreen> {
  final List<Map<String, dynamic>> _beneficiaries = [
    {
      'id': '1',
      'name': 'John Doe',
      'account': '0123456789',
      'bank': 'Access Bank',
      'bankCode': '044',
      'lastUsed': DateTime.now().subtract(const Duration(days: 2)),
    },
    {
      'id': '2',
      'name': 'Ada Love',
      'account': '2233445566',
      'bank': 'GTBank',
      'bankCode': '058',
      'lastUsed': DateTime.now().subtract(const Duration(days: 7)),
    },
    {
      'id': '3',
      'name': 'Chinedu Okonkwo',
      'account': '1122334455',
      'bank': 'First Bank',
      'bankCode': '011',
      'lastUsed': DateTime.now().subtract(const Duration(days: 14)),
    },
  ];

  Future<void> _handleRefresh() async {
    await Future.delayed(const Duration(seconds: 1));
  }

  void _sendToBeneficiary(Map<String, dynamic> beneficiary) {
    Navigator.pushNamed(context, '/transfer', arguments: beneficiary);
  }

  void _deleteBeneficiary(Map<String, dynamic> beneficiary) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Beneficiary'),
        content: Text('Are you sure you want to remove ${beneficiary['name']} from your saved beneficiaries?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              setState(() {
                _beneficiaries.removeWhere((b) => b['id'] == beneficiary['id']);
              });
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('${beneficiary['name']} removed')),
              );
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _addBeneficiary() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Beneficiary'),
        content: const Text('Add beneficiary functionality coming soon!'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  String _getInitials(String name) {
    final parts = name.split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.substring(0, 1).toUpperCase();
  }

  Color _getAvatarColor(String name) {
    final colors = [
      AppTheme.primaryColor,
      Colors.blue,
      Colors.green,
      Colors.orange,
      Colors.purple,
      Colors.teal,
    ];
    return colors[name.length % colors.length];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Saved Beneficiaries'),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline),
            onPressed: _addBeneficiary,
            tooltip: 'Add Beneficiary',
          ),
        ],
      ),
      body: _beneficiaries.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.people_outline,
                    size: 80,
                    color: Colors.grey[400],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No Saved Beneficiaries',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.getTextPrimary(context),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Add beneficiaries for quick transfers',
                    style: TextStyle(color: AppTheme.getTextSecondary(context)),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: _addBeneficiary,
                    icon: const Icon(Icons.add),
                    label: const Text('Add Beneficiary'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryDark,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 12,
                      ),
                    ),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: _handleRefresh,
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _beneficiaries.length,
                itemBuilder: (context, index) {
                  final beneficiary = _beneficiaries[index];
                  return Card(
                    elevation: 2,
                    margin: const EdgeInsets.only(bottom: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: InkWell(
                      onTap: () => _sendToBeneficiary(beneficiary),
                      borderRadius: BorderRadius.circular(16),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 28,
                              backgroundColor: _getAvatarColor(beneficiary['name']),
                              child: Text(
                                _getInitials(beneficiary['name']),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    beneficiary['name'],
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                      color: AppTheme.getTextPrimary(context),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    beneficiary['bank'],
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: Colors.grey[600],
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    beneficiary['account'],
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey[500],
                                      fontFamily: 'monospace',
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              children: [
                                IconButton(
                                  icon: Icon(
                                    Icons.send_outlined,
                                    color: AppTheme.primaryColor,
                                  ),
                                  onPressed: () => _sendToBeneficiary(beneficiary),
                                  tooltip: 'Send Money',
                                ),
                                IconButton(
                                  icon: Icon(
                                    Icons.delete_outline,
                                    color: Colors.red[400],
                                  ),
                                  onPressed: () => _deleteBeneficiary(beneficiary),
                                  tooltip: 'Delete',
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
