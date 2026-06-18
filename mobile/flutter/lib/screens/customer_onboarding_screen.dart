import 'package:flutter/material.dart';

class CustomerOnboardingScreen extends StatefulWidget {
  const CustomerOnboardingScreen({super.key});
  @override
  State<CustomerOnboardingScreen> createState() => _CustomerOnboardingScreenState();
}

class _CustomerOnboardingScreenState extends State<CustomerOnboardingScreen> {
  int _currentStep = 0;
  final _formKey = GlobalKey<FormState>();
  String _firstName = '';
  String _lastName = '';
  String _bvn = '';
  String _nin = '';
  String _phoneNumber = '';
  String _email = '';
  String _dateOfBirth = '';
  String _gender = 'Male';
  String _accountType = 'Savings';
  String _selectedTier = 'Tier 1';
  bool _termsAccepted = false;
  bool _bvnVerified = false;
  bool _ninVerified = false;

  final List<String> _tiers = ['Tier 1', 'Tier 2', 'Tier 3'];
  final Map<String, Map<String, String>> _tierLimits = {
    'Tier 1': {'single': '₦50,000', 'daily': '₦300,000', 'balance': '₦300,000'},
    'Tier 2': {'single': '₦200,000', 'daily': '₦500,000', 'balance': '₦500,000'},
    'Tier 3': {'single': '₦5,000,000', 'daily': '₦10,000,000', 'balance': 'Unlimited'},
  };

  void _verifyBVN() {
    if (_bvn.length == 11) {
      setState(() => _bvnVerified = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('BVN verified successfully'), backgroundColor: Colors.green),
      );
    }
  }

  void _verifyNIN() {
    if (_nin.length == 11) {
      setState(() => _ninVerified = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('NIN verified successfully'), backgroundColor: Colors.green),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Customer Onboarding'), backgroundColor: Colors.green[700]),
      body: Stepper(
        currentStep: _currentStep,
        onStepContinue: () {
          if (_currentStep == 0 && !_bvnVerified) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Please verify BVN first')),
            );
            return;
          }
          if (_currentStep < 4) setState(() => _currentStep++);
        },
        onStepCancel: () {
          if (_currentStep > 0) setState(() => _currentStep--);
        },
        steps: [
          Step(
            title: const Text('Identity Verification'),
            isActive: _currentStep >= 0,
            content: Column(children: [
              TextFormField(decoration: const InputDecoration(labelText: 'BVN (11 digits)', prefixIcon: Icon(Icons.fingerprint)),
                onChanged: (v) => _bvn = v, keyboardType: TextInputType.number, maxLength: 11),
              const SizedBox(height: 8),
              ElevatedButton.icon(onPressed: _verifyBVN, icon: const Icon(Icons.verified), label: Text(_bvnVerified ? 'BVN Verified' : 'Verify BVN'),
                style: ElevatedButton.styleFrom(backgroundColor: _bvnVerified ? Colors.green : null)),
              const SizedBox(height: 16),
              TextFormField(decoration: const InputDecoration(labelText: 'NIN (11 digits)', prefixIcon: Icon(Icons.badge)),
                onChanged: (v) => _nin = v, keyboardType: TextInputType.number, maxLength: 11),
              ElevatedButton.icon(onPressed: _verifyNIN, icon: const Icon(Icons.verified), label: Text(_ninVerified ? 'NIN Verified' : 'Verify NIN'),
                style: ElevatedButton.styleFrom(backgroundColor: _ninVerified ? Colors.green : null)),
            ]),
          ),
          Step(
            title: const Text('Personal Details'),
            isActive: _currentStep >= 1,
            content: Form(key: _formKey, child: Column(children: [
              TextFormField(decoration: const InputDecoration(labelText: 'First Name'), onChanged: (v) => _firstName = v),
              TextFormField(decoration: const InputDecoration(labelText: 'Last Name'), onChanged: (v) => _lastName = v),
              TextFormField(decoration: const InputDecoration(labelText: 'Phone Number'), onChanged: (v) => _phoneNumber = v, keyboardType: TextInputType.phone),
              TextFormField(decoration: const InputDecoration(labelText: 'Email'), onChanged: (v) => _email = v, keyboardType: TextInputType.emailAddress),
              DropdownButtonFormField<String>(value: _gender, decoration: const InputDecoration(labelText: 'Gender'),
                items: ['Male', 'Female'].map((g) => DropdownMenuItem(value: g, child: Text(g))).toList(),
                onChanged: (v) => setState(() => _gender = v!)),
            ])),
          ),
          Step(
            title: const Text('Account Type'),
            isActive: _currentStep >= 2,
            content: Column(children: [
              DropdownButtonFormField<String>(value: _accountType, decoration: const InputDecoration(labelText: 'Account Type'),
                items: ['Savings', 'Current', 'Domiciliary', 'Corporate'].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                onChanged: (v) => setState(() => _accountType = v!)),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(value: _selectedTier, decoration: const InputDecoration(labelText: 'CBN KYC Tier'),
                items: _tiers.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                onChanged: (v) => setState(() => _selectedTier = v!)),
              const SizedBox(height: 12),
              Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Tier Limits for $_selectedTier', style: const TextStyle(fontWeight: FontWeight.bold)),
                Text('Single Transaction: ${_tierLimits[_selectedTier]!["single"]}'),
                Text('Daily Limit: ${_tierLimits[_selectedTier]!["daily"]}'),
                Text('Max Balance: ${_tierLimits[_selectedTier]!["balance"]}'),
              ]))),
            ]),
          ),
          Step(
            title: const Text('Document Upload'),
            isActive: _currentStep >= 3,
            content: Column(children: [
              ListTile(leading: const Icon(Icons.photo_camera), title: const Text('Passport Photograph'), trailing: const Icon(Icons.upload), onTap: () {}),
              ListTile(leading: const Icon(Icons.badge), title: const Text('Valid ID (Driver License / Intl Passport / Voter Card)'), trailing: const Icon(Icons.upload), onTap: () {}),
              ListTile(leading: const Icon(Icons.home), title: const Text('Proof of Address (Utility Bill)'), trailing: const Icon(Icons.upload), onTap: () {}),
              if (_selectedTier == 'Tier 3') ListTile(leading: const Icon(Icons.work), title: const Text('Reference Letter'), trailing: const Icon(Icons.upload), onTap: () {}),
            ]),
          ),
          Step(
            title: const Text('Review & Submit'),
            isActive: _currentStep >= 4,
            content: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Name: $_firstName $_lastName', style: const TextStyle(fontSize: 16)),
                Text('BVN: $_bvn ${_bvnVerified ? "(Verified)" : "(Unverified)"}'),
                Text('Account Type: $_accountType'),
                Text('KYC Tier: $_selectedTier'),
              ]))),
              CheckboxListTile(value: _termsAccepted, onChanged: (v) => setState(() => _termsAccepted = v!),
                title: const Text('I agree to the Terms & Conditions and CBN KYC requirements')),
              ElevatedButton(onPressed: _termsAccepted ? () {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Account application submitted successfully!')));
              } : null, child: const Text('Submit Application')),
            ]),
          ),
        ],
      ),
    );
  }
}
