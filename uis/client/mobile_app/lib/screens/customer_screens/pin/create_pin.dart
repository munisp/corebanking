import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;
import 'package:url_launcher/url_launcher.dart';
import '../../../services/api_service.dart';
import '../../../services/account_service.dart';
import '../../../services/local_storage_service.dart';
import '../../../config/app_config.dart';
import '../../../models/user.dart';
import '../../../widgets/error_snackbar.dart';

class CreatePinScreen extends StatefulWidget {
  final bool isOnboarding; // True if coming from onboarding, false if from settings

  const CreatePinScreen({super.key, this.isOnboarding = false});

  @override
  State<CreatePinScreen> createState() => _CreatePinScreenState();
}

class _CreatePinScreenState extends State<CreatePinScreen> {
  final ApiService _apiService = ApiService();
  final AccountService _accountService = AccountService();
  final _pinController = TextEditingController();
  final _confirmPinController = TextEditingController();
  final _currentPinController = TextEditingController();
  final _pinFocusNode = FocusNode();
  final _confirmPinFocusNode = FocusNode();
  final _currentPinFocusNode = FocusNode();
  
  String _enteredPin = '';
  String _confirmedPin = '';
  String _currentPin = '';
  bool _isConfirmingPin = false;
  bool _isChangingPin = false; // True if changing existing PIN
  bool _needsCurrentPin = false; // True if we need to verify current PIN first
  bool _obscurePin = true;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _checkIfPinExists();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_needsCurrentPin) {
        _currentPinFocusNode.requestFocus();
      } else {
        _pinFocusNode.requestFocus();
      }
    });
  }

  /// Check if user already has a PIN (has account_id in storage)
  Future<void> _checkIfPinExists() async {
    if (widget.isOnboarding) {
      // Onboarding flow - always create new PIN (no account exists yet)
      setState(() {
        _isChangingPin = false;
        _needsCurrentPin = false;
      });
      return;
    }

    // Check if account_id exists (indicates user has account and might have PIN)
    try {
      String? accountId;
      if (kIsWeb) {
        try {
          accountId = html.window.localStorage['account_id'];
        } catch (_) {}
      } else {
        try {
          final prefs = await SharedPreferences.getInstance();
          accountId = prefs.getString('account_id');
        } catch (_) {}
      }

      if (accountId != null && accountId.isNotEmpty) {
        // User has account - assume they want to change PIN
        setState(() {
          _isChangingPin = true;
          _needsCurrentPin = true;
        });
      } else {
        // No account - create new PIN
        setState(() {
          _isChangingPin = false;
          _needsCurrentPin = false;
        });
      }
    } catch (e) {
      // Default to create new PIN on error
      setState(() {
        _isChangingPin = false;
        _needsCurrentPin = false;
      });
    }
  }

  void _onPinDigitEntered(String digit) {
    setState(() {
      if (_needsCurrentPin) {
        // Entering current PIN
        if (_currentPin.length < 4) {
          _currentPin += digit;
          _currentPinController.text = _currentPin;
          
          if (_currentPin.length == 4) {
            _verifyCurrentPin();
          }
        }
      } else if (_isConfirmingPin) {
        // Confirming new PIN
        if (_confirmedPin.length < 4) {
          _confirmedPin += digit;
          _confirmPinController.text = _confirmedPin;
          
          if (_confirmedPin.length == 4) {
            _validateAndCreatePin();
          }
        }
      } else {
        // Entering new PIN
        if (_enteredPin.length < 4) {
          _enteredPin += digit;
          _pinController.text = _enteredPin;
          
          if (_enteredPin.length == 4) {
            setState(() {
              _isConfirmingPin = true;
            });
            Future.delayed(const Duration(milliseconds: 200), () {
              _confirmPinFocusNode.requestFocus();
            });
          }
        }
      }
    });
  }

  /// Verify current PIN before allowing change
  Future<void> _verifyCurrentPin() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final result = await _accountService.verifyPin(_currentPin);
      
      if (!mounted) return;

      if (result['success'] == true) {
        // Current PIN verified - proceed to enter new PIN
        setState(() {
          _needsCurrentPin = false;
          _currentPin = '';
          _currentPinController.clear();
          _isLoading = false;
        });
        Future.delayed(const Duration(milliseconds: 200), () {
          _pinFocusNode.requestFocus();
        });
      } else {
        // Current PIN incorrect
        setState(() {
          _currentPin = '';
          _currentPinController.clear();
          _isLoading = false;
        });
        
        ErrorSnackbar.show(
          context,
          result['message'] ?? 'Current PIN is incorrect. Please try again.',
        );
        
        _currentPinFocusNode.requestFocus();
      }
    } catch (e) {
      if (!mounted) return;
      
      setState(() {
        _currentPin = '';
        _currentPinController.clear();
        _isLoading = false;
      });
      
      ErrorSnackbar.show(
        context,
        'Error verifying PIN: ${e.toString()}',
      );
      
      _currentPinFocusNode.requestFocus();
    }
  }

  void _onDeletePressed() {
    setState(() {
      if (_needsCurrentPin) {
        if (_currentPin.isNotEmpty) {
          _currentPin = _currentPin.substring(0, _currentPin.length - 1);
          _currentPinController.text = _currentPin;
        }
      } else if (_isConfirmingPin) {
        if (_confirmedPin.isNotEmpty) {
          _confirmedPin = _confirmedPin.substring(0, _confirmedPin.length - 1);
          _confirmPinController.text = _confirmedPin;
        }
      } else {
        if (_enteredPin.isNotEmpty) {
          _enteredPin = _enteredPin.substring(0, _enteredPin.length - 1);
          _pinController.text = _enteredPin;
        }
      }
    });
  }

  Future<void> _validateAndCreatePin() async {
    if (_enteredPin != _confirmedPin) {
      ErrorSnackbar.show(
        context,
        'PINs do not match. Please try again.',
      );
      
      setState(() {
        _enteredPin = '';
        _confirmedPin = '';
        _isConfirmingPin = false;
        _pinController.clear();
        _confirmPinController.clear();
      });
      
      _pinFocusNode.requestFocus();
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      if (widget.isOnboarding) {
        // Onboarding flow - create customer with PIN
        final onboardingDataStr = await LocalStorageService.getString('onboarding_data');
        
        if (onboardingDataStr == null || onboardingDataStr.isEmpty) {
          throw Exception('Onboarding data not found. Please start registration again.');
        }
        
        final onboardingData = jsonDecode(onboardingDataStr) as Map<String, dynamic>;
        
        // Get additional onboarding data
        final accountType = await LocalStorageService.getString('onboarding_account_type') ?? 'individual';
        final bvn = await LocalStorageService.getString('onboarding_bvn') ?? '';
        final address = await LocalStorageService.getString('onboarding_address') ?? '';
        final city = await LocalStorageService.getString('onboarding_city') ?? '';
        final state = await LocalStorageService.getString('onboarding_state') ?? '';
        final postalCode = await LocalStorageService.getString('onboarding_postal_code') ?? '';

        // Create customer with all onboarding data
        final customerData = <String, dynamic>{
          'email': onboardingData['email'] as String,
          'password': onboardingData['password'] as String,
          'firstName': onboardingData['firstName'] as String,
          'lastName': onboardingData['lastName'] as String,
          'phone': onboardingData['phoneNumber'] as String,
          'pin': _enteredPin,
          'accountType': accountType,
          'address': address,
          'city': city,
          'state': state,
          'postalCode': postalCode,
          'country': 'Nigeria',
        };
        
        // Add optional fields only if they have values
        if (bvn.isNotEmpty) customerData['bvn'] = bvn;
        if (onboardingData['uin'] != null && (onboardingData['uin'] as String).isNotEmpty) {
          customerData['uin'] = onboardingData['uin'];
        }

        final response = await _apiService.post(
          '${AppConfig.orchestratorEndpoint}/customer',
          data: customerData,
        );
        
        if (!mounted) return;
        
        if (response.statusCode == 200 || response.statusCode == 201) {
          final responseData = response.data;
          final data = responseData['data'] ?? responseData;
          
          // Setup PIN separately after customer creation (matching orchestrator service pattern)
          try {
            await _accountService.setupPin(_enteredPin);
          } catch (e) {
            // Log but don't fail - PIN might already be set via customer creation
            debugPrint('PIN setup after customer creation: $e');
          }
          
          // Store user data if available
          if (data['user'] != null) {
            final user = User.fromJson(data['user']);
            await LocalStorageService.setString('user_data', jsonEncode(user.toJson()));
          }
          
          // Store account_id if available (needed for future operations)
          if (data['account_id'] != null) {
            await LocalStorageService.setString('account_id', data['account_id'].toString());
          }
          if (data['id'] != null && data['account_id'] == null) {
            await LocalStorageService.setString('account_id', data['id'].toString());
          }
          
          // Clear onboarding data
          await LocalStorageService.removeMultiple([
            'onboarding_data',
            'onboarding_account_type',
            'onboarding_bvn',
            'onboarding_address',
            'onboarding_city',
            'onboarding_state',
            'onboarding_postal_code',
          ]);

          // Navigate to external KYC verification link (if present)
          final verificationUrl = responseData['verification'] ?? data['verification'];
          if (verificationUrl != null && mounted) {
            final uri = Uri.parse(verificationUrl.toString());
            if (await canLaunchUrl(uri)) {
              await launchUrl(uri, mode: LaunchMode.externalApplication);
              // After opening verification link, still show success screen
              // User can complete verification later
              if (mounted) {
                Navigator.pushNamedAndRemoveUntil(
                  context,
                  '/pin-created',
                  arguments: {
                    'isOnboarding': true,
                  },
                  (route) => false,
                );
              }
            } else {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: const Text('Could not open verification link'),
                  backgroundColor: Colors.red[600],
                ),
              );
              // Navigate to success screen even if link can't be opened
              if (mounted) {
                Navigator.pushNamedAndRemoveUntil(
                  context,
                  '/pin-created',
                  arguments: {
                    'isOnboarding': true,
                  },
                  (route) => false,
                );
              }
            }
          } else {
            // No verification URL - navigate directly to success screen
            if (mounted) {
              Navigator.pushNamedAndRemoveUntil(
                context,
                '/pin-created',
                arguments: {
                  'isOnboarding': true,
                },
                (route) => false,
              );
            }
          }
        } else {
          throw Exception(response.data['message'] ?? 'Failed to create customer');
        }
      } else {
        // Settings flow - setup or change PIN using account service
        Map<String, dynamic> result;
        
        if (_isChangingPin) {
          // Change PIN (verify current, then setup new)
          result = await _accountService.changePin(
            currentPin: _currentPin,
            newPin: _enteredPin,
          );
        } else {
          // Setup new PIN
          result = await _accountService.setupPin(_enteredPin);
        }
        
        if (!mounted) return;
        
        if (result['success'] == true) {
          ErrorSnackbar.showSuccess(
            context,
            result['message'] ?? (_isChangingPin ? 'PIN changed successfully' : 'PIN setup successfully'),
          );
          
          // Navigate back to settings
          if (mounted) {
            Navigator.pop(context);
          }
        } else {
          throw Exception(result['message'] ?? 'Failed to ${_isChangingPin ? 'change' : 'setup'} PIN');
        }
      }
    } catch (e) {
      if (!mounted) return;
      
      ErrorSnackbar.show(
        context,
        e.toString().replaceFirst('Exception: ', ''),
      );
      
      setState(() {
        _enteredPin = '';
        _confirmedPin = '';
        _isConfirmingPin = false;
        _pinController.clear();
        _confirmPinController.clear();
      });
      
      _pinFocusNode.requestFocus();
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: Colors.grey[800]),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 20),
              
              // Lock icon
              Center(
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    color: Colors.blue[700],
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.blue[700]!.withOpacity(0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.lock_outline,
                      size: 50,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
              
              const SizedBox(height: 32),
              
              // Title
              Text(
                _needsCurrentPin
                    ? 'Enter Current PIN'
                    : _isConfirmingPin
                        ? 'Confirm Your PIN'
                        : _isChangingPin
                            ? 'Enter New PIN'
                            : 'Create Your PIN',
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
                textAlign: TextAlign.center,
              ),
              
              const SizedBox(height: 8),
              
              Text(
                _needsCurrentPin
                    ? 'Enter your current 4-digit PIN to continue'
                    : _isConfirmingPin
                        ? 'Re-enter your 4-digit PIN to confirm'
                        : _isChangingPin
                            ? 'Create a new 4-digit PIN'
                            : 'Create a secure 4-digit PIN for quick access',
                style: TextStyle(
                  fontSize: 15,
                  color: Colors.grey[600],
                ),
                textAlign: TextAlign.center,
              ),
              
              const SizedBox(height: 48),
              
              // PIN display
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(4, (index) {
                  final currentPin = _needsCurrentPin
                      ? _currentPin
                      : _isConfirmingPin
                          ? _confirmedPin
                          : _enteredPin;
                  final isFilled = index < currentPin.length;
                  
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 8),
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: isFilled ? Colors.blue[700] : Colors.grey[100],
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isFilled ? Colors.blue[700]! : Colors.grey[300]!,
                        width: 2,
                      ),
                    ),
                    child: Center(
                      child: _obscurePin && isFilled
                          ? Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                              ),
                            )
                          : Text(
                              isFilled ? currentPin[index] : '',
                              style: const TextStyle(
                                fontSize: 28,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  );
                }),
              ),
              
              const SizedBox(height: 24),
              
              // Toggle PIN visibility
              Center(
                child: TextButton.icon(
                  onPressed: () {
                    setState(() {
                      _obscurePin = !_obscurePin;
                    });
                  },
                  icon: Icon(
                    _obscurePin ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                    size: 20,
                    color: Colors.grey[600],
                  ),
                  label: Text(
                    _obscurePin ? 'Show PIN' : 'Hide PIN',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[600],
                    ),
                  ),
                ),
              ),
              
              const SizedBox(height: 48),
              
              // Loading indicator
              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Center(
                    child: CircularProgressIndicator(),
                  ),
                )
              else
                // Number pad
                _buildNumberPad(),
              
              const SizedBox(height: 32),
              
              // Hidden text fields (for accessibility)
              Offstage(
                child: Column(
                  children: [
                    TextField(
                      controller: _currentPinController,
                      focusNode: _currentPinFocusNode,
                      keyboardType: TextInputType.number,
                      maxLength: 4,
                      obscureText: true,
                    ),
                    TextField(
                      controller: _pinController,
                      focusNode: _pinFocusNode,
                      keyboardType: TextInputType.number,
                      maxLength: 4,
                      obscureText: true,
                    ),
                    TextField(
                      controller: _confirmPinController,
                      focusNode: _confirmPinFocusNode,
                      keyboardType: TextInputType.number,
                      maxLength: 4,
                      obscureText: true,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNumberPad() {
    return Column(
      children: [
        _buildNumberRow(['1', '2', '3']),
        const SizedBox(height: 16),
        _buildNumberRow(['4', '5', '6']),
        const SizedBox(height: 16),
        _buildNumberRow(['7', '8', '9']),
        const SizedBox(height: 16),
        _buildNumberRow(['', '0', 'del']),
      ],
    );
  }

  Widget _buildNumberRow(List<String> numbers) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: numbers.map((number) {
        if (number.isEmpty) {
          return const SizedBox(width: 80, height: 80);
        }
        
        if (number == 'del') {
          return GestureDetector(
            onTap: _onDeletePressed,
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 12),
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(40),
                border: Border.all(color: Colors.grey[300]!, width: 1),
              ),
              child: Center(
                child: Icon(
                  Icons.backspace_outlined,
                  size: 28,
                  color: Colors.grey[700],
                ),
              ),
            ),
          );
        }
        
        return GestureDetector(
          onTap: () => _onPinDigitEntered(number),
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 12),
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(40),
              border: Border.all(color: Colors.grey[300]!, width: 2),
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.withOpacity(0.1),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Center(
              child: Text(
                number,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey[800],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  @override
  void dispose() {
    _pinController.dispose();
    _confirmPinController.dispose();
    _currentPinController.dispose();
    _pinFocusNode.dispose();
    _confirmPinFocusNode.dispose();
    _currentPinFocusNode.dispose();
    super.dispose();
  }
}