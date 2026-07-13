import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../services/lpo_service.dart';
import '../../../services/business_service.dart';
import '../../../services/api_service.dart';
import '../../../config/app_config.dart';
import '../../../providers/auth_provider.dart';
import '../../../widgets/success_dialog.dart';


class LPOApplicationScreen extends StatefulWidget {
  const LPOApplicationScreen({super.key});

  @override
  State<LPOApplicationScreen> createState() => _LPOApplicationScreenState();
}

class _LPOApplicationScreenState extends State<LPOApplicationScreen> {
  final LPOService _lpoService = LPOService(ApiService());
  final _formKey = GlobalKey<FormState>();
  bool _isSubmitting = false;
  bool _isLoadingBusinesses = true;

  // Registered businesses list
  List<Map<String, dynamic>> _businesses = [];
  List<Map<String, dynamic>> _filteredBusinesses = [];
  Map<String, dynamic>? _selectedBusiness;
  final TextEditingController _businessSearchController = TextEditingController();
  bool _showBusinessDropdown = false;

  final TextEditingController _issuingOrgController = TextEditingController();
  final TextEditingController _lpoAmountController = TextEditingController();
  final TextEditingController _financingAmountController = TextEditingController();
  final TextEditingController _repaymentDaysController = TextEditingController(text: "30");
  String? _uploadedFilePath;
  String? _uploadedFileName;
  String? _documentUrl = "";

  @override
  void initState() {
    super.initState();
    _fetchBusinesses();
  }

  @override
  void dispose() {
    _issuingOrgController.dispose();
    _businessSearchController.dispose();
    _lpoAmountController.dispose();
    _financingAmountController.dispose();
    _repaymentDaysController.dispose();
    super.dispose();
  }

  Future<void> _fetchBusinesses() async {
    setState(() => _isLoadingBusinesses = true);
    try {
      final list = await BusinessService().getBusinesses();
      setState(() {
        _businesses = list;
        _filteredBusinesses = list;
        _isLoadingBusinesses = false;
      });
    } catch (e) {
      debugPrint('Failed to load businesses: $e');
      setState(() => _isLoadingBusinesses = false);
    }
  }

  void _filterBusinesses(String query) {
    setState(() {
      _filteredBusinesses = _businesses.where((b) {
        final name = (b['name'] ?? '').toString().toLowerCase();
        final reg = (b['registration_number'] ?? '').toString().toLowerCase();
        return name.contains(query.toLowerCase()) || reg.contains(query.toLowerCase());
      }).toList();
    });
  }

  Future<void> _pickDocument() async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
      );

      if (result != null) {
        setState(() {
          _uploadedFileName = result.files.single.name;
          _uploadedFilePath = result.files.single.path;
        });

        // Web app: uploads to ${AppConfig.lpoEndpoint}/upload-document
        // For now, set a placeholder URL (matching web app behavior)
        _documentUrl = 'https://www.google.com'; // Placeholder, matching web app
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error picking file: ${e.toString()}'),
          backgroundColor: Colors.red[600],
        ),
      );
    }
  }

  /// Matches web app: validate and submit LPO application
  Future<void> _applyForLPO() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_selectedBusiness == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: const Text('Please select a business'), backgroundColor: Colors.red[600]),
      );
      return;
    }

    if (_uploadedFileName == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Please upload LPO document'),
          backgroundColor: Colors.red[600],
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final authProvider = context.read<AuthProvider>();
      final user = authProvider.currentUser;
      
      if (user == null) {
        throw Exception('User not authenticated');
      }

      // Get keycloak_id for lpoNumber (matching web app)
      String? keycloakId;
      try {
        final prefs = await SharedPreferences.getInstance();
        keycloakId = prefs.getString('keycloak_id');
      } catch (_) {
        // Skip if fails
      }

      // Get tenant_id from SharedPreferences (matching web app: user.tenantId || user.id)
      String? tenantId;
      try {
        final prefs = await SharedPreferences.getInstance();
        tenantId = prefs.getString('tenant_id');
      } catch (_) {
        // Skip if fails
      }

      // Web app: lpoService.applyForLPO throws on error, returns data on success
      await _lpoService.applyForLPO(
        supplierId: _selectedBusiness!['id'].toString(),
        tenantId: tenantId ?? user.id,
        lpoNumber: keycloakId ?? '',
        issuingOrganization: _issuingOrgController.text.trim(),
        lpoAmount: double.parse(_lpoAmountController.text),
        financingAmount: double.parse(_financingAmountController.text),
        repaymentDays: int.parse(_repaymentDaysController.text),
        lpoDocumentUrl: _documentUrl ?? '',
      );

      if (!mounted) return;

      // Show success dialog (matching web app)
      await SuccessDialog.show(
        context: context,
        title: 'LPO Application Submitted!',
        message: "Your LPO financing application has been submitted successfully. We'll review it and get back to you shortly.",
        buttonText: 'Done',
        onContinue: _handleSuccessClose,
      );
    } catch (e) {
      if (!mounted) return;
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.error_outline, color: Colors.white),
              const SizedBox(width: 12),
              Expanded(child: Text("Error submitting LPO application: ${e.toString().replaceAll('Exception: ', '')}")),
            ],
          ),
          backgroundColor: Colors.red[600],
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: const Duration(seconds: 4),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  void _handleSuccessClose() {
    // Navigate to active LPOs screen after successful submission
    // Close the success dialog first, then navigate
    Navigator.of(context).pop(); // Close success dialog
    Navigator.of(context).pop(); // Close application screen
    Navigator.pushReplacementNamed(context, '/active-lpos');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Apply for LPO"),
        elevation: 0,
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Theme.of(context).colorScheme.primary, Colors.green[500]!],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Theme.of(context).colorScheme.primary.withOpacity(0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.description,
                            color: Colors.white,
                            size: 28,
                          ),
                        ),
                        const SizedBox(width: 16),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'LPO Application',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                'Fill in the details below',
                                style: TextStyle(
                                  color: Colors.white70,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Business Information Section
              _buildSectionCard(
                title: 'Business Information',
                icon: Icons.business,
                children: [
                  if (_isLoadingBusinesses)
                    const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
                  else
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_selectedBusiness != null) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.primary.withOpacity(0.08),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Theme.of(context).colorScheme.primary.withOpacity(0.3)),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(_selectedBusiness!['name']?.toString() ?? '',
                                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                                      Text('Reg: ${_selectedBusiness!['registration_number'] ?? ''}',
                                          style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.close, size: 18),
                                  onPressed: () => setState(() {
                                    _selectedBusiness = null;
                                    _issuingOrgController.clear();
                                    _businessSearchController.clear();
                                  }),
                                ),
                              ],
                            ),
                          ),
                        ] else ...[
                          TextFormField(
                            controller: _businessSearchController,
                            onChanged: (q) {
                              _filterBusinesses(q);
                              setState(() => _showBusinessDropdown = true);
                            },
                            onTap: () => setState(() => _showBusinessDropdown = true),
                            decoration: const InputDecoration(
                              labelText: 'Search Business *',
                              hintText: 'Type business name or registration',
                              prefixIcon: Icon(Icons.search),
                              border: OutlineInputBorder(),
                            ),
                          ),
                          if (_showBusinessDropdown)
                            Container(
                              constraints: const BoxConstraints(maxHeight: 200),
                              margin: const EdgeInsets.only(top: 4),
                              decoration: BoxDecoration(
                                color: Theme.of(context).cardColor,
                                border: Border.all(color: Colors.grey.shade300),
                                borderRadius: BorderRadius.circular(8),
                                boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
                              ),
                              child: _filteredBusinesses.isEmpty
                                  ? const Padding(
                                      padding: EdgeInsets.all(12),
                                      child: Text('No businesses found', style: TextStyle(fontSize: 13)),
                                    )
                                  : ListView.builder(
                                      shrinkWrap: true,
                                      itemCount: _filteredBusinesses.length,
                                      itemBuilder: (context, i) {
                                        final b = _filteredBusinesses[i];
                                        return InkWell(
                                          onTap: () => setState(() {
                                            _selectedBusiness = b;
                                            _issuingOrgController.text = b['name']?.toString() ?? '';
                                            _businessSearchController.clear();
                                            _showBusinessDropdown = false;
                                          }),
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
                        const SizedBox(height: 16),
                        _buildTextField(
                          controller: _issuingOrgController,
                          label: 'Issuing Organization',
                          icon: Icons.domain,
                          readOnly: true,
                          validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
                        ),
                      ],
                    ),
                ],
              ),

              const SizedBox(height: 16),

              // LPO Details Section (matching web app - no LPO Number field, no Tenant ID)
              _buildSectionCard(
                title: 'LPO Details',
                icon: Icons.receipt_long,
                children: [
                  _buildTextField(
                    controller: _lpoAmountController,
                    label: 'LPO Amount (₦)',
                    icon: Icons.attach_money,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
                    ],
                    validator: (v) {
                      if (v?.isEmpty ?? true) return 'Required';
                      if (double.tryParse(v!) == null) return 'Invalid amount';
                      if (double.parse(v) <= 0) return 'Must be greater than 0';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    controller: _financingAmountController,
                    label: 'Financing Amount (₦)',
                    icon: Icons.account_balance,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
                    ],
                    validator: (v) {
                      if (v?.isEmpty ?? true) return 'Required';
                      if (double.tryParse(v!) == null) return 'Invalid amount';
                      if (double.parse(v) <= 0) return 'Must be greater than 0';
                      final lpoAmount = double.tryParse(_lpoAmountController.text);
                      if (lpoAmount != null && double.parse(v) > lpoAmount) {
                        return 'Cannot exceed LPO amount';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    controller: _repaymentDaysController,
                    label: 'Repayment Period (Days)',
                    icon: Icons.calendar_today,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    validator: (v) {
                      if (v?.isEmpty ?? true) return 'Required';
                      if (int.tryParse(v!) == null) return 'Invalid number';
                      if (int.parse(v) <= 0) return 'Must be greater than 0';
                      return null;
                    },
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Document Section
              _buildSectionCard(
                title: 'LPO Document',
                icon: Icons.upload_file,
                children: [
                  if (_uploadedFileName == null) ...[
                    // Upload button
                    InkWell(
                      onTap: _pickDocument,
                      child: Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.grey[300]!, width: 2, style: BorderStyle.solid),
                          borderRadius: BorderRadius.circular(12),
                          color: Colors.blue[50],
                        ),
                        child: Column(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.blue[100],
                                shape: BoxShape.circle,
                              ),
                              child: Icon(Icons.upload_file, size: 32, color: Colors.blue[700]),
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              'Click to upload',
                              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'PDF, JPG, PNG (Max 10MB)',
                              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ] else ...[
                    // Uploaded file display
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.green[300]!, width: 2),
                        borderRadius: BorderRadius.circular(12),
                        color: Colors.green[50],
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.red[100],
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(Icons.picture_as_pdf, size: 32, color: Colors.red[600]),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _uploadedFileName!,
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const Text(
                                  'Upload successful',
                                  style: TextStyle(fontSize: 12, color: Colors.green),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: () {
                              setState(() {
                                _uploadedFileName = null;
                                _uploadedFilePath = null;
                              });
                            },
                            icon: const Icon(Icons.close, color: Colors.red),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (_uploadedFileName == null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        'Please upload LPO document',
                        style: TextStyle(fontSize: 12, color: Colors.red[600]),
                      ),
                    ),
                ],
              ),

              const SizedBox(height: 32),

              // Submit Button
              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _applyForLPO,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 2,
                    disabledBackgroundColor: Colors.grey[300],
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.send, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Submit Application',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                ),
              ),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).primaryColorDark,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.primary,
            blurRadius: 2,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: Colors.blue[700], size: 20),
              ),
              const SizedBox(width: 12),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          ...children,
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    List<TextInputFormatter>? inputFormatters,
    String? Function(String?)? validator,
    int maxLines = 1,
    bool readOnly = false,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      validator: validator,
      maxLines: maxLines,
      readOnly: readOnly,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: Theme.of(context).colorScheme.primary, size: 20),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.outline.withOpacity(0.5),
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.outline.withOpacity(0.5),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.primary,
            width: 2,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.error,
            width: 1,
          ),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.error,
            width: 2,
          ),
        ),
        filled: true,
        fillColor: Theme.of(context).colorScheme.surface.withOpacity(0.3),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
    );
  }
}

/// Success Screen Component (matching web app)
class _SuccessScreen extends StatelessWidget {
  final String title;
  final String message;
  final VoidCallback onContinue;
  final String buttonText;

  const _SuccessScreen({
    required this.title,
    required this.message,
    required this.onContinue,
    required this.buttonText,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black54,
      child: Center(
        child: Container(
          margin: const EdgeInsets.all(24),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.2),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green[50],
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.check_circle,
                  size: 64,
                  color: Colors.green[600],
                ),
              ),
              const SizedBox(height: 24),
              Text(
                title,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).textTheme.bodyLarge?.color,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                message,
                style: TextStyle(
                  fontSize: 14,
                  color: Theme.of(context).textTheme.bodyMedium?.color?.withOpacity(0.7),
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: onContinue,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(buttonText),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}