import 'package:flutter/material.dart';
import 'dart:convert';
import '../../../config/app_theme.dart';
import '../../../config/app_config.dart';
import '../../../services/api_service.dart';
import '../../../services/local_storage_service.dart';
import '../../../models/user.dart';
import '../../widgets/csc_picker.dart';


class AddressVerificationScreen extends StatefulWidget {
  const AddressVerificationScreen({super.key});

  @override
  State<AddressVerificationScreen> createState() =>
      _AddressVerificationScreenState();
}

class _AddressVerificationScreenState extends State<AddressVerificationScreen> {
  final _formKey = GlobalKey<FormState>();
  final ApiService _apiService = ApiService();
  String _address = '';
  String _city = '';
  String _state = '';
  String _postalCode = '';
  bool _isCreatingCustomer = false;

  String? _selectedCountry;
  String? _selectedState;
  String? _selectedCity;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Address Verification'),
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
                Text(
                  'Verify Your Address',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.getTextPrimary(context),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Provide your current residential address',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppTheme.getTextSecondary(context),
                  ),
                ),
                const SizedBox(height: 24),

                // Street Address
                TextFormField(
                  decoration: InputDecoration(
                    labelText: 'Street Address',
                    hintText: 'Enter your house address',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.outline.withOpacity(0.5),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.outline.withOpacity(0.5),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                    ),
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 1,
                      ),
                    ),
                    focusedErrorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 2,
                      ),
                    ),
                    filled: true,
                    fillColor: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.3),
                    prefixIcon: Icon(
                      Icons.location_on_outlined,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                  onChanged: (value) => _address = value,
                  validator: (value) {
                    if (value?.isEmpty ?? true) {
                      return 'Street address is required';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Country, State, City Picker
                CSCPicker(
                  onCountryChanged: (country) {
                    setState(() {
                      _selectedCountry = country;
                    });
                  },
                  onStateChanged: (state) {
                    setState(() {
                      _selectedState = state;
                      _state = state ?? '';
                    });
                  },
                  onCityChanged: (city) {
                    setState(() {
                      _selectedCity = city;
                      _city = city ?? '';
                    });
                  },
                  defaultCountry: _selectedCountry ?? 'Nigeria',
                  defaultState: _selectedState,
                  defaultCity: _selectedCity,
                  countryRequired: true,
                  stateRequired: true,
                  cityRequired: true,
                ),
                const SizedBox(height: 16),

                // Postal Code
                TextFormField(
                  decoration: InputDecoration(
                    labelText: 'Postal Code',
                    hintText: 'e.g., 101001',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.outline.withOpacity(0.5),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.outline.withOpacity(0.5),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                    ),
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 1,
                      ),
                    ),
                    focusedErrorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 2,
                      ),
                    ),
                    filled: true,
                    fillColor: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.3),
                    prefixIcon: Icon(
                      Icons.mail_outline,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                  onChanged: (value) => _postalCode = value,
                  validator: (value) {
                    if (value != null && value.isNotEmpty) {
                      if (value.length < 5) {
                        return 'Please enter a valid postal code';
                      }
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 32),

                SizedBox(
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _isCreatingCustomer ? null : _saveAddressAndContinue,
                    style: ElevatedButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isCreatingCustomer
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Text('Continue'),
                  ),
                ),
                const SizedBox(height: 12),
                // TextButton(
                //   onPressed: _isCreatingCustomer ? null : _skipAddress,
                //   child: const Text('Skip for now'),
                // ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _saveAddressAndContinue() async {
    if (!_formKey.currentState!.validate()) {
      return; // Stop if validation fails
    }

    // Get account type from navigation arguments
    final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    final accountType = args?['accountType'];
    final isKycCompletion = args?['isKycCompletion'] == true;
    
    if (isKycCompletion) {
      // Coming from KYC completion flow in settings
      Navigator.pushReplacementNamed(context, '/kyc-complete-success');
      return;
    }

    // Regular onboarding flow - create customer
    setState(() {
      _isCreatingCustomer = true;
    });

    try {
      final onboardingDataStr = await LocalStorageService.getString('onboarding_data');
      
      if (onboardingDataStr == null) {
        throw Exception('Onboarding data not found. Please start registration again.');
      }
      
      final onboardingData = jsonDecode(onboardingDataStr) as Map<String, dynamic>;
      
      // Get additional onboarding data
      final accountTypeValue = await LocalStorageService.getString('onboarding_account_type') ?? accountType ?? 'individual';
      final bvn = await LocalStorageService.getString('onboarding_bvn') ?? '';
      final address = _address.isNotEmpty ? _address : (await LocalStorageService.getString('onboarding_address') ?? '');
      final city = _city.isNotEmpty ? _city : (await LocalStorageService.getString('onboarding_city') ?? '');
      final state = _state.isNotEmpty ? _state : (await LocalStorageService.getString('onboarding_state') ?? '');
      final postalCode = _postalCode.isNotEmpty ? _postalCode : (await LocalStorageService.getString('onboarding_postal_code') ?? '');

      // Store address data
      if (address.isNotEmpty && city.isNotEmpty && state.isNotEmpty) {
        await LocalStorageService.setString('onboarding_address', address);
        await LocalStorageService.setString('onboarding_city', city);
        await LocalStorageService.setString('onboarding_state', state);
        if (postalCode.isNotEmpty) {
          await LocalStorageService.setString('onboarding_postal_code', postalCode);
        }
      }

      // Determine endpoint based on account type
      late Map<String, dynamic> payload;
      late String endpoint;

      if (accountTypeValue == 'business') {
        final businessName = await LocalStorageService.getString('onboarding_business_name') ?? '';
        final tin = await LocalStorageService.getString('onboarding_tin') ?? '';
        final cac = await LocalStorageService.getString('onboarding_cac') ?? '';

        if (businessName.isEmpty || tin.isEmpty || cac.isEmpty) {
          throw Exception('Business details incomplete. Please restart the registration.');
        }

        endpoint = '${AppConfig.orchestratorEndpoint}/business';
        payload = {
          'email': onboardingData['email'] as String,
          'password': onboardingData['password'] as String,
          'firstName': onboardingData['firstName'] as String,
          'lastName': onboardingData['lastName'] as String,
          'phone': onboardingData['phoneNumber'] as String,
          'businessName': businessName,
          'tin': tin,
          'cac': cac,
          'address': address,
          'city': city,
          'state': state,
          'postalCode': postalCode,
        };
        if (onboardingData['uin'] != null && (onboardingData['uin'] as String).isNotEmpty) {
          payload['uin'] = onboardingData['uin'];
        }
      } else {
        endpoint = '${AppConfig.orchestratorEndpoint}/customer';
        payload = {
          'email': onboardingData['email'] as String,
          'password': onboardingData['password'] as String,
          'firstName': onboardingData['firstName'] as String,
          'lastName': onboardingData['lastName'] as String,
          'phone': onboardingData['phoneNumber'] as String,
          'accountType': accountTypeValue,
          'address': address,
          'city': city,
          'state': state,
          'postalCode': postalCode,
          'country': 'Nigeria',
        };
        if (bvn.isNotEmpty) payload['bvn'] = bvn;
        if (onboardingData['uin'] != null && (onboardingData['uin'] as String).isNotEmpty) {
          payload['uin'] = onboardingData['uin'];
        }
      }

      final response = await _apiService.post(endpoint, data: payload);
      
      if (!mounted) return;
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final responseData = response.data;
        final data = responseData['data'] ?? responseData;
        
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
          'onboarding_business_name',
          'onboarding_tin',
          'onboarding_cac',
        ]);

        // Check for customer creation/verification link in response
        final verificationUrl = responseData['verification'] ??
                                data['verification'] ?? 
                                responseData['creation_link'] ?? 
                                data['creation_link'];

        // Navigate to onboarding completion screen
        if (mounted) {
          Navigator.pushReplacementNamed(
            context,
            '/onboarding-completion',
            arguments: {
              'accountType': accountTypeValue,
              'kycComplete': false,
              'verificationUrl': verificationUrl?.toString(),
            },
          );
        }
      } else {
        throw Exception(response.data?['message'] ?? 
                       response.data?['error'] ?? 
                       'Failed to create account. Status: ${response.statusCode}');
      }
    } catch (e) {
      if (!mounted) return;
      
      // Show error message
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 5),
        ),
      );
      
      setState(() {
        _isCreatingCustomer = false;
      });
    }
  }

  Future<void> _skipAddress() async {
    // Get account type from navigation arguments
    final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    final accountType = args?['accountType'];
    final isKycCompletion = args?['isKycCompletion'] == true;
    
    if (isKycCompletion) {
      // Coming from KYC completion flow in settings
      Navigator.pushReplacementNamed(context, '/kyc-complete-success');
      return;
    }

    // Regular onboarding flow - create customer without address
    setState(() {
      _isCreatingCustomer = true;
    });

    try {
      final onboardingDataStr = await LocalStorageService.getString('onboarding_data');
      
      if (onboardingDataStr == null || onboardingDataStr.isEmpty) {
        // Debug: Check what keys exist in storage
        final allKeys = await LocalStorageService.getKeys();
        debugPrint('Onboarding data not found. Available keys: $allKeys');
        throw Exception('Onboarding data not found. Please start registration again.');
      }
      
      final onboardingData = jsonDecode(onboardingDataStr) as Map<String, dynamic>;
      
      // Get additional onboarding data
      final accountTypeValue = await LocalStorageService.getString('onboarding_account_type') ?? accountType ?? 'individual';
      final bvn = await LocalStorageService.getString('onboarding_bvn') ?? '';

      // Clear any stored address data
      await LocalStorageService.removeMultiple([
        'onboarding_address',
        'onboarding_city',
        'onboarding_state',
        'onboarding_postal_code',
      ]);

      // Create customer WITHOUT PIN and without address - user will set it in settings after login
      final customerData = <String, dynamic>{
        'email': onboardingData['email'] as String,
        'password': onboardingData['password'] as String,
        'firstName': onboardingData['firstName'] as String,
        'lastName': onboardingData['lastName'] as String,
        'phone': onboardingData['phoneNumber'] as String,
        // Note: PIN is not included - user will set it in settings
        'accountType': accountTypeValue,
        'address': '',
        'city': '',
        'state': '',
        'postalCode': '',
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
          'onboarding_business_name',
          'onboarding_tin',
          'onboarding_cac',
        ]);

        // Check for customer creation/verification link in response
        final verificationUrl = responseData['verification'] ?? 
                                data['verification'] ?? 
                                responseData['creation_link'] ?? 
                                data['creation_link'];

        // Navigate to onboarding completion screen
        if (mounted) {
          Navigator.pushReplacementNamed(
            context,
            '/onboarding-completion',
            arguments: {
              'accountType': accountTypeValue,
              'kycComplete': false,
              'verificationUrl': verificationUrl?.toString(),
            },
          );
        }
      } else {
        throw Exception(response.data?['message'] ?? 
                       response.data?['error'] ?? 
                       'Failed to create account. Status: ${response.statusCode}');
      }
    } catch (e) {
      if (!mounted) return;
      
      // Show error message
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 5),
        ),
      );
      
      setState(() {
        _isCreatingCustomer = false;
      });
    }
  }
}