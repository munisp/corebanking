import 'package:flutter/material.dart';
import '../../../services/local_storage_service.dart';
import '../../../services/verification_service.dart';
import '../../../config/app_theme.dart';

class BvnVerificationScreen extends StatefulWidget {
  const BvnVerificationScreen({super.key});

  @override
  State<BvnVerificationScreen> createState() => _BvnVerificationScreenState();
}

class _BvnVerificationScreenState extends State<BvnVerificationScreen> {
  final _bvnController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  final VerificationService _verificationService = VerificationService();
  
  bool _isVerifying = false;
  String? _verificationMessage;
  bool? _bvnIsValid;

  Future<void> _saveBvnAndContinue() async {
    if (!_formKey.currentState!.validate()) return;

    // Get account data from navigation arguments
    final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    final accountType = args?['accountType'];

    // Store BVN for later use in customer creation (no API call) - only if provided
    final bvn = _bvnController.text.trim();
    if (bvn.isNotEmpty) {
      await LocalStorageService.setString('onboarding_bvn', bvn);
    } else {
      await LocalStorageService.remove('onboarding_bvn');
    }
    
    // Navigate to address verification (matching web app: /onboarding-address)
    if (mounted) {
      Navigator.pushReplacementNamed(
        context,
        '/onboarding-address',
        arguments: {
          'accountType': accountType,
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('BVN Verification'),
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.blue[50],
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue[200]!),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, color: Colors.blue[700]),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'CBN requires BVN for all accounts',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.blue[900],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
                Text(
                  'Bank Verification Number (BVN)',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.getTextPrimary(context),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'An 11-digit unique identifier issued by the CBN',
                  style: TextStyle(
                    fontSize: 14, 
                    color: AppTheme.getTextSecondary(context),
                  ),
                ),
                const SizedBox(height: 24),
                TextFormField(
                  controller: _bvnController,
                  keyboardType: TextInputType.number,
                  maxLength: 11,
                  onChanged: (value) async {
                    // Verify BVN as user types (when 11 digits entered)
                    if (value.length == 11) {
                      setState(() {
                        _isVerifying = true;
                        _verificationMessage = null;
                        _bvnIsValid = null;
                      });

                      final result = await _verificationService.verifyBVN(value);
                      
                      if (mounted) {
                        setState(() {
                          _isVerifying = false;
                          _bvnIsValid = result['valid'] as bool?;
                          _verificationMessage = result['message'] as String?;
                        });
                      }
                    } else {
                      setState(() {
                        _verificationMessage = null;
                        _bvnIsValid = null;
                      });
                    }
                  },
                  decoration: InputDecoration(
                    labelText: 'BVN',
                    hintText: '12345678901',
                    prefixIcon: Icon(
                      Icons.badge_outlined,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    suffixIcon: _isVerifying
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: Padding(
                              padding: EdgeInsets.all(12),
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : _bvnIsValid == true
                            ? Icon(
                                Icons.check_circle,
                                color: AppTheme.successColor,
                                size: 22,
                              )
                            : _bvnIsValid == false
                                ? Icon(
                                    Icons.error,
                                    color: AppTheme.errorColor,
                                    size: 22,
                                  )
                                : null,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.outline.withOpacity(0.5),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: _bvnIsValid == false
                            ? AppTheme.errorColor
                            : Theme.of(context).colorScheme.outline.withOpacity(0.5),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: _bvnIsValid == false
                            ? AppTheme.errorColor
                            : Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                    ),
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: AppTheme.errorColor,
                        width: 1,
                      ),
                    ),
                    focusedErrorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: AppTheme.errorColor,
                        width: 2,
                      ),
                    ),
                    filled: true,
                    fillColor: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.3),
                    counterText: '',
                  ),
                  validator: (v) {
                    if (v != null && v.isNotEmpty) {
                      if (v.length != 11) return 'BVN must be 11 digits';
                      if (!RegExp(r'^\d{11}$').hasMatch(v)) return 'Digits only';
                      if (_bvnIsValid == false) {
                        return _verificationMessage ?? 'Invalid BVN';
                      }
                    }
                    return null;
                  },
                ),
                if (_verificationMessage != null && _bvnController.text.length == 11) ...[
                  const SizedBox(height: 4),
                  Text(
                    _verificationMessage!,
                    style: TextStyle(
                      fontSize: 12,
                      color: _bvnIsValid == true
                          ? AppTheme.successColor
                          : AppTheme.errorColor,
                    ),
                  ),
                ],
                const SizedBox(height: 32),
                SizedBox(
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _saveBvnAndContinue,
                    style: ElevatedButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Continue'),
                  ),
                ),
                const SizedBox(height: 12),
                // TextButton(
                //   onPressed: () async {
                //     await LocalStorageService.remove('onboarding_bvn');
                    
                //     final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
                //     final accountType = args?['accountType'];
                    
                //     if (mounted) {
                //       Navigator.pushReplacementNamed(
                //         context,
                //         '/onboarding-address',
                //         arguments: {
                //           'accountType': accountType,
                //         },
                //       );
                //     }
                //   },
                //   // child: const Text('Skip for now'),
                // ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _bvnController.dispose();
    super.dispose();
  }
}
