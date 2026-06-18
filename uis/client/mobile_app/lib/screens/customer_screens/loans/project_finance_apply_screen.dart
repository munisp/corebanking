import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../services/business_service.dart';
import '../../../services/api_service.dart';
import '../../../config/app_config.dart';

class ProjectFinanceApplyScreen extends StatefulWidget {
  const ProjectFinanceApplyScreen({super.key});

  @override
  State<ProjectFinanceApplyScreen> createState() =>
      _ProjectFinanceApplyScreenState();
}

class _ProjectFinanceApplyScreenState extends State<ProjectFinanceApplyScreen> {
  final _formKey = GlobalKey<FormState>();
  final _projectNameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _financeAmountController = TextEditingController();
  final _durationController = TextEditingController(text: '12');
  final _businessSearchController = TextEditingController();

  List<Map<String, dynamic>> _businesses = [];
  List<Map<String, dynamic>> _filteredBusinesses = [];
  Map<String, dynamic>? _selectedBusiness;
  bool _loadingBusinesses = true;
  bool _showBusinessDropdown = false;
  String? _selectedSector;
  bool _submitting = false;

  static const _sectors = [
    'Infrastructure', 'Energy', 'Real Estate', 'Manufacturing',
    'Agriculture', 'Technology', 'Healthcare', 'Education', 'Other',
  ];

  @override
  void initState() {
    super.initState();
    _loadBusinesses();
  }

  Future<void> _loadBusinesses() async {
    final list = await BusinessService().getBusinesses();
    setState(() {
      _businesses = list;
      _filteredBusinesses = list;
      _loadingBusinesses = false;
    });
  }

  void _filterBusinesses(String query) {
    setState(() {
      _filteredBusinesses = _businesses.where((b) {
        final name = (b['name'] ?? '').toString().toLowerCase();
        final reg = (b['registration_number'] ?? '').toString().toLowerCase();
        return name.contains(query.toLowerCase()) ||
            reg.contains(query.toLowerCase());
      }).toList();
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedBusiness == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a business')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final apiService = ApiService();
      final payload = <String, dynamic>{
        'business_id': _selectedBusiness!['id'],
        'business_name': _selectedBusiness!['name'],
        'project_name': _projectNameController.text.trim(),
        'project_description': _descriptionController.text.trim(),
        'finance_amount': double.parse(_financeAmountController.text),
        'duration_months': int.parse(_durationController.text),
      };
      if (_selectedSector != null) payload['sector'] = _selectedSector;

      await apiService.post(
        '${AppConfig.loanEndpoint}/project-finance',
        data: payload,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Project finance application submitted!'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to submit: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _projectNameController.dispose();
    _descriptionController.dispose();
    _financeAmountController.dispose();
    _durationController.dispose();
    _businessSearchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Project Finance Application')),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Business selector
              _SectionCard(
                title: 'Business',
                icon: Icons.business,
                children: [
                  if (_loadingBusinesses)
                    const Center(child: CircularProgressIndicator())
                  else
                    _BusinessSelector(
                      businesses: _filteredBusinesses,
                      selectedBusiness: _selectedBusiness,
                      searchController: _businessSearchController,
                      showDropdown: _showBusinessDropdown,
                      onSearch: (q) {
                        _filterBusinesses(q);
                        setState(() => _showBusinessDropdown = true);
                      },
                      onSelect: (b) => setState(() {
                        _selectedBusiness = b;
                        _businessSearchController.clear();
                        _showBusinessDropdown = false;
                      }),
                      onClear: () => setState(() {
                        _selectedBusiness = null;
                        _businessSearchController.clear();
                      }),
                      onToggle: (v) => setState(() => _showBusinessDropdown = v),
                    ),
                ],
              ),
              const SizedBox(height: 16),

              // Project details
              _SectionCard(
                title: 'Project Details',
                icon: Icons.account_tree,
                children: [
                  TextFormField(
                    controller: _projectNameController,
                    decoration: const InputDecoration(
                      labelText: 'Project Name *',
                      hintText: 'e.g., Solar Farm Phase 1, Highway Extension',
                      prefixIcon: Icon(Icons.folder_open),
                    ),
                    validator: (v) =>
                        v == null || v.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    value: _selectedSector,
                    decoration: const InputDecoration(
                      labelText: 'Sector (optional)',
                      prefixIcon: Icon(Icons.category),
                    ),
                    items: _sectors
                        .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                        .toList(),
                    onChanged: (v) => setState(() => _selectedSector = v),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _descriptionController,
                    decoration: const InputDecoration(
                      labelText: 'Project Description (optional)',
                      hintText: 'Describe the scope and objectives',
                      prefixIcon: Icon(Icons.notes),
                    ),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _financeAmountController,
                          decoration: const InputDecoration(
                            labelText: 'Finance Amount (₦) *',
                            prefixIcon: Icon(Icons.attach_money),
                          ),
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}'))
                          ],
                          validator: (v) {
                            if (v == null || v.isEmpty) return 'Required';
                            if (double.tryParse(v) == null || double.parse(v) <= 0) {
                              return 'Invalid';
                            }
                            return null;
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _durationController,
                          decoration: const InputDecoration(
                            labelText: 'Duration (months) *',
                            prefixIcon: Icon(Icons.calendar_today),
                          ),
                          keyboardType: TextInputType.number,
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          validator: (v) {
                            if (v == null || v.isEmpty) return 'Required';
                            if (int.tryParse(v) == null || int.parse(v) <= 0) {
                              return 'Invalid';
                            }
                            return null;
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 32),
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: _submitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: theme.colorScheme.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _submitting
                      ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                      : const Text('Submit Application',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
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
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: theme.colorScheme.primary, size: 20),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }
}

class _BusinessSelector extends StatelessWidget {
  final List<Map<String, dynamic>> businesses;
  final Map<String, dynamic>? selectedBusiness;
  final TextEditingController searchController;
  final bool showDropdown;
  final ValueChanged<String> onSearch;
  final ValueChanged<Map<String, dynamic>> onSelect;
  final VoidCallback onClear;
  final ValueChanged<bool> onToggle;

  const _BusinessSelector({
    required this.businesses,
    required this.selectedBusiness,
    required this.searchController,
    required this.showDropdown,
    required this.onSearch,
    required this.onSelect,
    required this.onClear,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (selectedBusiness != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: theme.colorScheme.primary.withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: theme.colorScheme.primary.withOpacity(0.3)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(selectedBusiness!['name']?.toString() ?? '',
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      Text('Reg: ${selectedBusiness!['registration_number'] ?? ''}',
                          style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                    ],
                  ),
                ),
                IconButton(icon: const Icon(Icons.close, size: 18), onPressed: onClear),
              ],
            ),
          )
        else ...[
          TextField(
            controller: searchController,
            onChanged: onSearch,
            onTap: () => onToggle(true),
            decoration: const InputDecoration(
              labelText: 'Search Registered Business *',
              hintText: 'Type business name or registration number',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
            ),
          ),
          if (showDropdown)
            Container(
              constraints: const BoxConstraints(maxHeight: 200),
              margin: const EdgeInsets.only(top: 4),
              decoration: BoxDecoration(
                color: theme.cardColor,
                border: Border.all(color: Colors.grey.shade300),
                borderRadius: BorderRadius.circular(8),
                boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
              ),
              child: businesses.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: Text('No businesses found'),
                    )
                  : ListView.builder(
                      shrinkWrap: true,
                      itemCount: businesses.length,
                      itemBuilder: (context, i) {
                        final b = businesses[i];
                        return InkWell(
                          onTap: () => onSelect(b),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(b['name']?.toString() ?? '',
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                                Text('Reg: ${b['registration_number'] ?? ''}',
                                    style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
        ],
      ],
    );
  }
}
