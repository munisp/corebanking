import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../widgets/api_list_screen.dart';

/// Account Opening Screen with Nigerian regulatory compliance
/// Implements: BVN validation, NIN validation, document upload, selfie capture, tier selection
class AccountOpeningScreen extends StatefulWidget {
  const AccountOpeningScreen({super.key});
  @override
  State<AccountOpeningScreen> createState() => _AccountOpeningScreenState();
}

class _AccountOpeningScreenState extends State<AccountOpeningScreen> {
  final _formKey = GlobalKey<FormState>();
  int _currentStep = 0;
  bool _isLoading = false;

  // Form fields
  final _bvnController = TextEditingController();
  final _ninController = TextEditingController();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _dobController = TextEditingController();
  final _addressController = TextEditingController();

  String _selectedTier = 'tier1';
  String _selectedIdType = 'national_id';
  String? _documentPath;
  String? _selfiePath;
  bool _bvnVerified = false;
  bool _ninVerified = false;

  // CBN Tier limits (daily)
  final _tierLimits = {
    'tier1': {'single': 50000, 'daily': 300000, 'balance': 300000, 'docs': 'BVN only'},
    'tier2': {'single': 200000, 'daily': 500000, 'balance': 500000, 'docs': 'BVN + NIN + Photo ID'},
    'tier3': {'single': 5000000, 'daily': 5000000, 'balance': 'unlimited', 'docs': 'Full KYC'},
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Open Account'), elevation: 0),
      body: Stepper(
        currentStep: _currentStep,
        onStepContinue: _onStepContinue,
        onStepCancel: _currentStep > 0 ? () => setState(() => _currentStep--) : null,
        steps: [
          _buildTierSelectionStep(),
          _buildBVNVerificationStep(),
          _buildPersonalInfoStep(),
          _buildDocumentUploadStep(),
          _buildSelfieStep(),
          _buildReviewStep(),
        ],
      ),
    );
  }

  Step _buildTierSelectionStep() {
    return Step(
      title: const Text('Select Account Tier'),
      subtitle: const Text('CBN regulatory tiers'),
      content: Column(
        children: _tierLimits.entries.map((entry) => RadioListTile<String>(
          title: Text(entry.key.toUpperCase()),
          subtitle: Text(
            'Max single: \u20A6${_formatAmount(entry.value['single'] as int)} | '
            'Daily: \u20A6${_formatAmount(entry.value['daily'] as int)}\n'
            'Required: ${entry.value['docs']}'
          ),
          value: entry.key,
          groupValue: _selectedTier,
          onChanged: (v) => setState(() => _selectedTier = v!),
        )).toList(),
      ),
      isActive: _currentStep >= 0,
    );
  }

  Step _buildBVNVerificationStep() {
    return Step(
      title: const Text('BVN Verification'),
      subtitle: Text(_bvnVerified ? 'Verified \u2713' : 'Enter 11-digit BVN'),
      content: Column(
        children: [
          TextFormField(
            controller: _bvnController,
            decoration: const InputDecoration(
              labelText: 'Bank Verification Number (BVN)',
              hintText: '22XXXXXXXXX',
              prefixIcon: Icon(Icons.fingerprint),
            ),
            keyboardType: TextInputType.number,
            maxLength: 11,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            validator: _validateBVN,
          ),
          if (_selectedTier != 'tier1') ...[
            const SizedBox(height: 16),
            TextFormField(
              controller: _ninController,
              decoration: const InputDecoration(
                labelText: 'National ID Number (NIN)',
                hintText: '11-digit NIN',
                prefixIcon: Icon(Icons.badge),
              ),
              keyboardType: TextInputType.number,
              maxLength: 11,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              validator: _validateNIN,
            ),
          ],
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _isLoading ? null : _verifyBVN,
            icon: _isLoading
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.verified),
            label: Text(_isLoading ? 'Verifying...' : 'Verify BVN'),
          ),
        ],
      ),
      isActive: _currentStep >= 1,
    );
  }

  Step _buildPersonalInfoStep() {
    return Step(
      title: const Text('Personal Information'),
      content: Form(
        key: _formKey,
        child: Column(
          children: [
            TextFormField(
              controller: _firstNameController,
              decoration: const InputDecoration(labelText: 'First Name', prefixIcon: Icon(Icons.person)),
              validator: (v) => v == null || v.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _lastNameController,
              decoration: const InputDecoration(labelText: 'Last Name', prefixIcon: Icon(Icons.person_outline)),
              validator: (v) => v == null || v.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phoneController,
              decoration: const InputDecoration(labelText: 'Phone (+234)', hintText: '08XXXXXXXXX', prefixIcon: Icon(Icons.phone)),
              keyboardType: TextInputType.phone,
              validator: _validateNigerianPhone,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _emailController,
              decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email)),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _dobController,
              decoration: const InputDecoration(labelText: 'Date of Birth', hintText: 'DD/MM/YYYY', prefixIcon: Icon(Icons.cake)),
              onTap: () => _selectDate(context),
              readOnly: true,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _addressController,
              decoration: const InputDecoration(labelText: 'Residential Address', prefixIcon: Icon(Icons.home)),
              maxLines: 2,
              validator: (v) => v == null || v.isEmpty ? 'Required for Tier 2+' : null,
            ),
          ],
        ),
      ),
      isActive: _currentStep >= 2,
    );
  }

  Step _buildDocumentUploadStep() {
    return Step(
      title: const Text('Document Upload'),
      subtitle: const Text('Government-issued photo ID'),
      content: Column(
        children: [
          DropdownButtonFormField<String>(
            value: _selectedIdType,
            decoration: const InputDecoration(labelText: 'ID Type'),
            items: const [
              DropdownMenuItem(value: 'national_id', child: Text('National ID Card')),
              DropdownMenuItem(value: 'international_passport', child: Text('International Passport')),
              DropdownMenuItem(value: 'drivers_license', child: Text("Driver's License")),
              DropdownMenuItem(value: 'voters_card', child: Text("Voter's Card")),
            ],
            onChanged: (v) => setState(() => _selectedIdType = v!),
          ),
          const SizedBox(height: 16),
          _documentPath != null
              ? Card(child: ListTile(leading: const Icon(Icons.check_circle, color: Colors.green), title: Text('Document uploaded: $_selectedIdType')))
              : OutlinedButton.icon(
                  onPressed: _pickDocument,
                  icon: const Icon(Icons.upload_file),
                  label: const Text('Upload Document'),
                ),
          const SizedBox(height: 8),
          const Text('Accepted: JPG, PNG, PDF. Max 5MB.', style: TextStyle(color: Colors.grey, fontSize: 12)),
        ],
      ),
      isActive: _currentStep >= 3,
    );
  }

  Step _buildSelfieStep() {
    return Step(
      title: const Text('Selfie Verification'),
      subtitle: const Text('Liveness check'),
      content: Column(
        children: [
          Container(
            height: 200, width: 200,
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.blue, width: 2)),
            child: _selfiePath != null
                ? const Icon(Icons.check_circle, size: 80, color: Colors.green)
                : const Icon(Icons.camera_alt, size: 60, color: Colors.grey),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _captureSelfie,
            icon: const Icon(Icons.camera),
            label: Text(_selfiePath != null ? 'Retake Selfie' : 'Take Selfie'),
          ),
          const SizedBox(height: 8),
          const Text('Ensure good lighting. Remove glasses and head coverings.', style: TextStyle(color: Colors.grey, fontSize: 12)),
        ],
      ),
      isActive: _currentStep >= 4,
    );
  }

  Step _buildReviewStep() {
    return Step(
      title: const Text('Review & Submit'),
      content: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Account Tier: ${_selectedTier.toUpperCase()}', style: const TextStyle(fontWeight: FontWeight.bold)),
              const Divider(),
              _infoRow('Name', '${_firstNameController.text} ${_lastNameController.text}'),
              _infoRow('BVN', _bvnController.text),
              _infoRow('Phone', _phoneController.text),
              _infoRow('Email', _emailController.text),
              _infoRow('DOB', _dobController.text),
              _infoRow('ID Type', _selectedIdType),
              _infoRow('Document', _documentPath != null ? 'Uploaded' : 'Missing'),
              _infoRow('Selfie', _selfiePath != null ? 'Captured' : 'Missing'),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _submitApplication,
                  child: const Text('Submit Application'),
                ),
              ),
            ],
          ),
        ),
      ),
      isActive: _currentStep >= 5,
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        SizedBox(width: 100, child: Text(label, style: const TextStyle(color: Colors.grey))),
        Expanded(child: Text(value)),
      ]),
    );
  }

  // --- Validators ---

  String? _validateBVN(String? value) {
    if (value == null || value.isEmpty) return 'BVN is required';
    if (value.length != 11) return 'BVN must be exactly 11 digits';
    if (!RegExp(r'^22[0-9]{9}$').hasMatch(value)) return 'Invalid BVN format (must start with 22)';
    return null;
  }

  String? _validateNIN(String? value) {
    if (value == null || value.isEmpty) return 'NIN is required for Tier 2+';
    if (value.length != 11) return 'NIN must be exactly 11 digits';
    return null;
  }

  String? _validateNigerianPhone(String? value) {
    if (value == null || value.isEmpty) return 'Phone number is required';
    final cleaned = value.replaceAll(RegExp(r'[^0-9]'), '');
    if (cleaned.length != 11) return 'Must be 11 digits';
    if (!RegExp(r'^0[789][01][0-9]{8}$').hasMatch(cleaned)) return 'Invalid Nigerian phone number';
    return null;
  }

  // --- Actions ---

  Future<void> _verifyBVN() async {
    if (_bvnController.text.length != 11) return;
    setState(() => _isLoading = true);
    await Future.delayed(const Duration(seconds: 2)); // Simulate API call
    setState(() { _bvnVerified = true; _isLoading = false; });
  }

  Future<void> _pickDocument() async {
    // In production: use image_picker or file_picker plugin
    setState(() => _documentPath = 'document_uploaded.jpg');
  }

  Future<void> _captureSelfie() async {
    // In production: use camera plugin with liveness detection
    setState(() => _selfiePath = 'selfie_captured.jpg');
  }

  Future<void> _selectDate(BuildContext context) async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime(1990),
      firstDate: DateTime(1940),
      lastDate: DateTime.now().subtract(const Duration(days: 6570)), // Min 18 years
    );
    if (date != null) {
      _dobController.text = '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
    }
  }

  void _onStepContinue() {
    if (_currentStep < 5) setState(() => _currentStep++);
  }

  Future<void> _submitApplication() async {
    setState(() => _isLoading = true);
    // Submit to backend API
    await Future.delayed(const Duration(seconds: 3));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Account application submitted successfully!'), backgroundColor: Colors.green),
      );
      Navigator.pop(context);
    }
  }

  String _formatAmount(int amount) {
    return amount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }

  @override
  void dispose() {
    _bvnController.dispose();
    _ninController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _dobController.dispose();
    _addressController.dispose();
    super.dispose();
  }
}
