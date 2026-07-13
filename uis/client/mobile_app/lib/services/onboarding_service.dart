import '../config/app_config.dart';
import 'api_service.dart';

class OnboardingService {
  final ApiService _apiService = ApiService();

  /// Step 1: Create Account
  /// POST /account
  /// Creates a new account with account_type and name
  Future<Map<String, dynamic>> createAccount({
    required String accountType,
    required String name,
  }) async {
    try {
      final response = await _apiService.post(
        AppConfig.accountEndpoint,
        data: {
          'account_type': accountType,
          'name': name,
        },
      );

      final responseData = response.data;
      if (responseData['success'] == true) {
        return {
          'success': true,
          'data': responseData['data'],
          'message': 'Account created successfully',
        };
      }

      return {
        'success': false,
        'message': responseData['message'] ?? 'Failed to create account',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Error creating account: ${e.toString()}',
      };
    }
  }

  /// Step 2: Initialize KYC Verification
  /// POST /kyc/initialize-verification
  /// Initializes KYC verification using BVN as UIN
  Future<Map<String, dynamic>> initializeKycVerification({
    required String identityProvider,
    required String firstName,
    required String lastName,
    required String phone,
    required String bvn, // BVN as UIN
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.kycEndpoint}/initialize-verification',
        data: {
          'identityProvider': identityProvider,
          'user': {
            'firstName': firstName,
            'lastName': lastName,
            'phone': phone,
            'UIN': bvn, // BVN passed as UIN
          },
        },
      );

      final responseData = response.data;
      if (responseData['success'] == true) {
        return {
          'success': true,
          'data': responseData['data'],
          'message': 'KYC verification initialized successfully',
        };
      }

      return {
        'success': false,
        'message': responseData['message'] ?? 'Failed to initialize KYC verification',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Error initializing KYC: ${e.toString()}',
      };
    }
  }

  /// Step 3: Setup PIN
  /// POST /account/setup-pin
  /// Sets up account PIN
  Future<Map<String, dynamic>> setupPin({
    required String pin,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.accountEndpoint}/setup-pin',
        data: {
          'pin': pin,
        },
      );

      final responseData = response.data;
      if (responseData['success'] == true) {
        return {
          'success': true,
          'data': responseData['data'],
          'message': 'PIN setup successfully',
        };
      }

      return {
        'success': false,
        'message': responseData['message'] ?? 'Failed to setup PIN',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Error setting up PIN: ${e.toString()}',
      };
    }
  }

  /// Step 4: Verify PIN
  /// POST /account/verify-pin
  /// Verifies the account PIN
  Future<Map<String, dynamic>> verifyPin({
    required String keycloakId,
    required String pin,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.accountEndpoint}/verify-pin',
        data: {
          'keycloak_id': keycloakId,
          'pin': pin,
        },
      );

      final responseData = response.data;
      if (responseData['success'] == true) {
        return {
          'success': true,
          'data': responseData['data'],
          'message': 'PIN verified successfully',
        };
      }

      return {
        'success': false,
        'message': responseData['message'] ?? 'Invalid PIN',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Error verifying PIN: ${e.toString()}',
      };
    }
  }

  /// Complete Onboarding Flow
  /// Orchestrates all onboarding steps
  Future<Map<String, dynamic>> completeOnboarding({
    required String accountType,
    required String accountName,
    required String identityProvider,
    required String firstName,
    required String lastName,
    required String phone,
    required String bvn,
    required String pin,
  }) async {
    try {
      // Step 1: Create Account
      final accountResult = await createAccount(
        accountType: accountType,
        name: accountName,
      );

      if (accountResult['success'] != true) {
        return accountResult;
      }

      // Step 2: Initialize KYC with BVN
      final kycResult = await initializeKycVerification(
        identityProvider: identityProvider,
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        bvn: bvn,
      );

      if (kycResult['success'] != true) {
        return {
          'success': false,
          'message': 'Account created but KYC initialization failed: ${kycResult['message']}',
          'accountData': accountResult['data'],
        };
      }

      // Step 3: Setup PIN
      final pinSetupResult = await setupPin(pin: pin);

      if (pinSetupResult['success'] != true) {
        return {
          'success': false,
          'message': 'Account and KYC completed but PIN setup failed: ${pinSetupResult['message']}',
          'accountData': accountResult['data'],
          'kycData': kycResult['data'],
        };
      }

      // Step 4: Verify PIN
      final keycloakId = accountResult['data']['keycloak_id'] ?? '';
      final pinVerifyResult = await verifyPin(
        keycloakId: keycloakId,
        pin: pin,
      );

      if (pinVerifyResult['success'] != true) {
        return {
          'success': false,
          'message': 'Onboarding completed but PIN verification failed: ${pinVerifyResult['message']}',
          'accountData': accountResult['data'],
          'kycData': kycResult['data'],
        };
      }

      // All steps completed successfully
      return {
        'success': true,
        'message': 'Onboarding completed successfully',
        'data': {
          'account': accountResult['data'],
          'kyc': kycResult['data'],
          'pinVerified': true,
        },
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Onboarding failed: ${e.toString()}',
      };
    }
  }

  /// Check Account Status
  /// GET /account
  /// Retrieves current account information
  Future<Map<String, dynamic>> getAccountStatus() async {
    try {
      final response = await _apiService.get(AppConfig.accountEndpoint);

      final responseData = response.data;
      if (responseData['success'] == true) {
        return {
          'success': true,
          'data': responseData['data'],
        };
      }

      return {
        'success': false,
        'message': responseData['message'] ?? 'Failed to get account status',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Error getting account status: ${e.toString()}',
      };
    }
  }
}
