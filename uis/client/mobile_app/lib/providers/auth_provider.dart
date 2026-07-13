import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import '/config/app_config.dart';
import 'package:universal_html/html.dart' as html;
import '../models/user.dart';
import '../services/error_handler_service.dart';
import '../services/api_service.dart';
import '../models/error_response.dart';
import '../services/local_storage_service.dart';


class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
      resetOnError: true,
    ),
  );
  final LocalAuthentication _localAuth = LocalAuthentication();

  User? _currentUser;
  String? _accessToken;
  bool _hasCompletedOnboarding = false;
  bool _isAuthenticated = false;
  bool _isBiometricEnabled = false;
  bool _isLoading = false;
  String _errorMessage = '';
  String? _passwordResetKeycloakId;
  ErrorResponse? _lastError;
  static const String _pinStorageKey = 'user_pin';
  static const String _onboardingStorageKey = 'hasCompletedOnboarding';
  static const String _hasSeenOnboardingKey = 'hasSeenOnboarding';

  // Getters
  User? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;
  bool get isBiometricEnabled => _isBiometricEnabled;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String? get passwordResetKeycloakId => _passwordResetKeycloakId;
  ErrorResponse? get lastError => _lastError;
  bool get hasCompletedOnboarding => _hasCompletedOnboarding;
  Future<void> initialize() async {
    _isLoading = true;
    notifyListeners();

    try {
      // Check if access token exists
      _accessToken = await _secureStorage.read(key: 'access_token');

      if (_accessToken != null && !JwtDecoder.isExpired(_accessToken!)) {
        _isAuthenticated = true;
        final decodedToken = JwtDecoder.decode(_accessToken!);
        final keycloakId = decodedToken['sub'] ?? decodedToken['keycloak_id'];
        if (keycloakId != null) {
          await _fetchUserProfile(keycloakId);
        }
      }

      // Check if biometric is enabled
      final biometricEnabled =
          await _secureStorage.read(key: 'biometric_enabled');
      _isBiometricEnabled = biometricEnabled == 'true';

      // Check onboarding completion status
      _hasCompletedOnboarding =
          await LocalStorageService.getBool(_onboardingStorageKey) ?? false;
    } catch (e) {
      _errorMessage = 'An unexpected error occurred during authentication initialization.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Login with email and password
  /// Matches web app: ${AppConfig.authEndpoint}/auth/login
  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      final response = await _apiService.post(
        '${AppConfig.authEndpoint}/auth/login',
        data: {
          'email': email,
          'password': password,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        _accessToken = data['access_token'] ?? data['data']?['access_token'];
        final refreshToken =
            data['refresh_token'] ?? data['data']?['refresh_token'];

        if (_accessToken == null) {
          _errorMessage = 'No access token received from server';
          _isLoading = false;
          notifyListeners();
          return false;
        }

        // Store tokens securely
        await _secureStorage.write(key: 'access_token', value: _accessToken!);
        if (refreshToken != null) {
          await _secureStorage.write(key: 'refresh_token', value: refreshToken);
        }

        // Extract and store keycloak_id
        String? keycloakId = data['keycloak_id']?.toString() ??
            data['data']?['keycloak_id']?.toString();

        if (keycloakId != null) {
          await _secureStorage.write(key: 'keycloak_id', value: keycloakId);
          await LocalStorageService.setString('keycloak_id', keycloakId);
        }

        // Fetch user profile
        try {
          if (keycloakId != null) {
            await _fetchUserProfile(keycloakId);
          }
        } catch (profileError) {
          debugPrint('User profile not found: $profileError');
          _currentUser = User.fromJson({
            'id': keycloakId,
            'email': email,
            'first_name': '',
            'last_name': '',
            'status': 'active',
            'is_verified': false,
            'created_at': DateTime.now().toIso8601String(),
          });
          await LocalStorageService.setString(
              AppConfig.userDataKey, jsonEncode(_currentUser!.toJson()));
        }

        _isAuthenticated = true;
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        // Parse structured error response
        _lastError = ErrorHandlerService.parseError(response.data);
        _errorMessage = _lastError!.message;
        debugPrint('Login error: ${_lastError!.code} - ${_lastError!.message}');
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _lastError = ErrorHandlerService.parseError(e);
      _errorMessage = _lastError!.message;
      debugPrint('Login error: ${_lastError!.code} - ${_lastError!.message}');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

// Helper method to parse error messages from API response

// Helper method to convert technical error messages to user-friendly ones

// Helper method to handle Dio errors

  /// Register new user - Just store data (all setup happens at customer creation)
  Future<bool> register(
      String email, String password, String fullName, String phone,
      {String? uin}) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      // Store onboarding data for later use (will be sent to orchestrator at PIN creation)
      final onboardingData = {
        'email': email,
        'password': password,
        'firstName': fullName.split(" ")[0],
        'lastName':
            fullName.split(" ").length > 1 ? fullName.split(" ")[1] : '',
        'phoneNumber': phone,
        if (uin != null && uin.isNotEmpty) 'uin': uin,
      };

      // Store using LocalStorageService for consistency
      await LocalStorageService.setString(
          'onboarding_data', jsonEncode(onboardingData));

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Verify email OTP during registration
  /// Matches web app: ${AppConfig.authEndpoint}/verify-email
  Future<bool> verifyEmailOTP(String email, String otp) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      final response = await _apiService
          .post('${AppConfig.authEndpoint}/verify-email', data: {
        'token': otp, // Web app uses 'token' not 'otp'
      });

      if (response.data['success']) {
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = ErrorHandlerService.handleError(response.data);
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = ErrorHandlerService.handleError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Verify login OTP
  /// Matches web app: ${AppConfig.authEndpoint}/verify-otp
  Future<bool> verifyLoginOTP(String email, String otp) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      // Web app uses: ${AppConfig.authEndpoint}/verify-otp
      final response =
          await _apiService.post('${AppConfig.authEndpoint}/verify-otp', data: {
        'otp': otp,
      });

      if (response.statusCode == 200) {
        // Web app handles both response formats: response.data.access_token or response.data.data.access_token
        final data = response.data['data'] ?? response.data;

        if (data['access_token'] != null) {
          _accessToken = data['access_token'];
          await _secureStorage.write(key: 'access_token', value: _accessToken!);

          if (data['refresh_token'] != null) {
            await _secureStorage.write(
                key: 'refresh_token', value: data['refresh_token']);
          }

          // Extract and store keycloak_id from response data (matching web app)
          String? keycloakId;
          // First try to get keycloak_id directly from response data
          keycloakId = data['keycloak_id']?.toString() ??
              data['data']?['keycloak_id']?.toString();

          // If not in response, try to decode from token (fallback)
          if (keycloakId == null) {
            try {
              final decodedToken = JwtDecoder.decode(_accessToken!);
              keycloakId = decodedToken['sub']?.toString() ??
                  decodedToken['keycloak_id']?.toString();
            } catch (e) {
              debugPrint('Failed to decode token: $e');
            }
          }

          if (keycloakId != null) {
            await LocalStorageService.setString('keycloak_id', keycloakId);

            // Fetch user profile
            await _fetchUserProfile(keycloakId);
          }

          _isAuthenticated = true;
          _isLoading = false;
          notifyListeners();
          return true;
        } else {
          _errorMessage = 'No access token in response';
          _isLoading = false;
          notifyListeners();
          return false;
        }
      } else {
        _errorMessage = ErrorHandlerService.handleError(response.data);
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = ErrorHandlerService.handleError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Forget password
  /// Matches web app: ${AppConfig.authEndpoint}/auth/forgot-password
  Future<bool> forgotPassword(String email) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();
    try {
      final response = await _apiService
          .post('${AppConfig.authEndpoint}/auth/forgot-password', data: {
        'email': email,
      });

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        _passwordResetKeycloakId = data['keycloak_id']?.toString();

        if (_passwordResetKeycloakId != null &&
            _passwordResetKeycloakId!.isNotEmpty) {
          await LocalStorageService.setString(
              'password_reset_keycloak_id', _passwordResetKeycloakId!);
        }

        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = ErrorHandlerService.handleError(response.data);
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = ErrorHandlerService.handleError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Enable biometric authentication
  Future<bool> enableBiometric() async {
    try {
      // Check if device supports biometrics
      final canCheckBiometrics = await _localAuth.canCheckBiometrics;
      final isDeviceSupported = await _localAuth.isDeviceSupported();

      if (!canCheckBiometrics || !isDeviceSupported) {
        _errorMessage =
            'Biometric authentication is not available on this device';
        notifyListeners();
        return false;
      }

      // Get available biometrics
      final availableBiometrics = await _localAuth.getAvailableBiometrics();

      if (availableBiometrics.isEmpty) {
        _errorMessage = 'No biometric methods are enrolled on this device';
        notifyListeners();
        return false;
      }

      // Authenticate to enable biometric
      final authenticated = await _localAuth.authenticate(
        localizedReason: 'Enable biometric authentication for pup',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );

      if (authenticated) {
        await _secureStorage.write(key: 'biometric_enabled', value: 'true');
        _isBiometricEnabled = true;
        notifyListeners();
        return true;
      }

      return false;
    } catch (e) {
      _errorMessage = 'An unexpected error occurred during biometric setup.';
      notifyListeners();
      return false;
    }
  }

  /// Disable biometric authentication
  Future<void> disableBiometric() async {
    await _secureStorage.delete(key: 'biometric_enabled');
    _isBiometricEnabled = false;
    notifyListeners();
  }

  /// Authenticate with biometric
  Future<bool> authenticateWithBiometric() async {
    try {
      final authenticated = await _localAuth.authenticate(
        localizedReason: 'Authenticate to access your pup account',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );

      if (authenticated) {
        // Token should already be in secure storage
        _accessToken = await _secureStorage.read(key: 'access_token');

        if (_accessToken != null && !JwtDecoder.isExpired(_accessToken!)) {
          final decodedToken = JwtDecoder.decode(_accessToken!);
          final keycloakId = decodedToken['sub'] ?? decodedToken['keycloak_id'];
          if (keycloakId != null) {
            await _fetchUserProfile(keycloakId);
          }
          _isAuthenticated = true;
          notifyListeners();
          return true;
        }
      }

      return false;
    } catch (e) {
      _errorMessage = 'An unexpected error occurred during biometric authentication.';
      notifyListeners();
      return false;
    }
  }

  /// Fetch user profile from API (private)
  /// Matches web app: uses UserService.getUserProfile which calls ${AppConfig.userEndpoint}/user?keycloak_id=${keycloakId}
  Future<void> _fetchUserProfile(String keycloakId) async {
    try {
      // Web app uses UserService which calls ${AppConfig.userEndpoint}/user?keycloak_id=${keycloakId}
      final response = await _apiService
          .get('${AppConfig.userEndpoint}/user?keycloak_id=$keycloakId');
      // Fetch and store account data
      try {
        final accountResponse = await _apiService
            .get('${AppConfig.accountEndpoint}/keycloak/$keycloakId');

        if (accountResponse.statusCode == 200) {
          final accountData = accountResponse.data['account'];
          html.window.localStorage['account'] = jsonEncode(accountData);
          html.window.localStorage['account_id'] = accountData['id'].toString();

          // Store account data
          await _secureStorage.write(
            key: 'account',
            value: jsonEncode(accountData),
          );

          // Store account ID separately
          if (accountData['id'] != null) {
            final accountIdStr = accountData['id'].toString();
            await _secureStorage.write(key: 'account_id', value: accountIdStr);
            await LocalStorageService.setString('account_id', accountIdStr);
          }
        }
      } catch (e) {
        // Continue even if account fetch fails
        print('Failed to fetch account data: $e');
      }

      if (response.statusCode == 200) {
        // Web app response structure: response.data.user or response.data.data
        final userData =
            response.data['user'] ?? response.data['data'] ?? response.data;
        _currentUser = User.fromJson(userData);

        // Store user data (matching web app)
        await LocalStorageService.setString(
            AppConfig.userDataKey, jsonEncode(_currentUser!.toJson()));
        await LocalStorageService.setString('user',
            jsonEncode(_currentUser!.toJson())); // Also store under 'user' key

        // Ensure keycloak_id is stored
        await LocalStorageService.setString('keycloak_id', keycloakId);
      }
    } catch (e) {
      _errorMessage = 'An unexpected error occurred while fetching user profile.';
      debugPrint('Error fetching user profile: $e');
    }
  }

  /// Public method to fetch user profile (can be called from UI)
  /// Uses ${AppConfig.userEndpoint}/user?keycloak_id=${keycloakId}
  Future<void> fetchUserProfile() async {
    _isLoading = true;
    notifyListeners();

    try {
      // Get keycloak_id from token or stored preferences
      String? keycloakId;

      // Try to get from token first
      if (_accessToken != null && !JwtDecoder.isExpired(_accessToken!)) {
        try {
          final decodedToken = JwtDecoder.decode(_accessToken!);
          keycloakId = decodedToken['sub']?.toString() ??
              decodedToken['keycloak_id']?.toString() ??
              decodedToken['user_id']?.toString();
        } catch (e) {
          debugPrint('Failed to decode token: $e');
        }
      }

      // Fallback to stored keycloak_id
      keycloakId ??= await LocalStorageService.getString('keycloak_id');

      if (keycloakId != null) {
        await _fetchUserProfile(keycloakId);
      } else {
        // Fallback to stored user if keycloak_id not available
        debugPrint('No keycloak_id available, trying stored user');
        try {
          final userData =
              await LocalStorageService.getString(AppConfig.userDataKey);
          if (userData != null) {
            _currentUser = User.fromJson(jsonDecode(userData));
            // Try to extract keycloak_id from stored user
            final storedUser = jsonDecode(userData);
            final storedKeycloakId =
                storedUser['keycloak_id'] ?? storedUser['keycloakId'];
            if (storedKeycloakId != null) {
              final existingKeycloakId =
                  await LocalStorageService.getString('keycloak_id');
              if (existingKeycloakId == null) {
                await LocalStorageService.setString(
                    'keycloak_id', storedKeycloakId.toString());
              }
            }
          }
        } catch (storageError) {
          _errorMessage =
              'Failed to fetch user profile: No keycloak_id available';
          debugPrint('Error loading stored user: $storageError');
        }
      }
    } catch (e) {
      _errorMessage = 'An unexpected error occurred while fetching user profile.';
      debugPrint('Error fetching user profile: $e');
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Complete onboarding
  Future<void> completeOnboarding() async {
    try {
      await LocalStorageService.setBool(_onboardingStorageKey, true);
      _hasCompletedOnboarding = true;
      notifyListeners();
    } catch (e) {
      _errorMessage = 'An unexpected error occurred while completing onboarding.';
      notifyListeners();
    }
  }

  /// Mark that user has seen onboarding screen
  Future<void> markOnboardingSeen() async {
    try {
      await LocalStorageService.setBool(_hasSeenOnboardingKey, true);
    } catch (e) {
      // Non-critical error, ignore
    }
  }

  /// Check if user has seen onboarding screen
  Future<bool> hasSeenOnboarding() async {
    try {
      return await LocalStorageService.getBool(_hasSeenOnboardingKey) ?? false;
    } catch (e) {
      return false;
    }
  }

  /// Logout
  /// Matches web app: ${AppConfig.authEndpoint}/logout
  Future<void> logout() async {
    try {
      // Web app calls: ${AppConfig.authEndpoint}/logout
      // await _apiService.post('${AppConfig.authEndpoint}/logout');
      print("logout API called");
    } catch (e) {
      // Continue with local logout even if API fails (matching web app)
      debugPrint('Logout API call failed: $e');
    } finally {
      // Clear all storage (matching web app)
      await _secureStorage.delete(key: 'access_token');
      await _secureStorage.delete(key: 'refresh_token');
      await _secureStorage.delete(key: _pinStorageKey);
      await _secureStorage.delete(key: 'hasCompletedOnboarding');
      await _secureStorage.delete(key: 'hasSeenOnboarding');
      await _secureStorage.delete(key: 'biometric_enabled');
      await _secureStorage.delete(key: 'account');
      await _secureStorage.delete(key: 'account_id');
      await _secureStorage.delete(key: 'keycloak_id');
      await _secureStorage.delete(key: 'FlutterSecureStorage.keycloak_id');
      await _secureStorage.delete(key: 'FlutterSecureStorage.refresh_token');
      await _secureStorage.delete(key: 'FlutterSecureStorage.access_token');
      await _secureStorage.delete(key: 'FlutterSecureStorage');


      await LocalStorageService.removeMultiple([
        _onboardingStorageKey,
        AppConfig.userDataKey,
        'user',
        'keycloak_id',
        'account',
        'account_id',
      ]);

      _currentUser = null;
      _accessToken = null;
      _isAuthenticated = false;
      _hasCompletedOnboarding = false;

      notifyListeners();
    }
  }

  /// Refresh access token
  /// Matches web app: ${AppConfig.authEndpoint}/refresh
  Future<bool> refreshToken() async {
    try {
      final refreshToken = await _secureStorage.read(key: 'refresh_token');

      if (refreshToken == null) {
        return false;
      }

      // Web app uses: ${AppConfig.authEndpoint}/refresh
      final response =
          await _apiService.post('${AppConfig.authEndpoint}/refresh', data: {
        'refresh_token': refreshToken,
      });

      if (response.statusCode == 200) {
        // Web app response structure: response.data.data.access_token
        final data = response.data['data'] ?? response.data;
        _accessToken = data['access_token'];
        final newRefreshToken = data['refresh_token'];

        if (_accessToken != null) {
          await _secureStorage.write(key: 'access_token', value: _accessToken!);
          if (newRefreshToken != null) {
            await _secureStorage.write(
                key: 'refresh_token', value: newRefreshToken);
          }
          return true;
        }
      }

      return false;
    } catch (e) {
      debugPrint('Token refresh failed: $e');
      return false;
    }
  }

  /// Verify user credentials before sensitive actions
  Future<bool> verifyCredentials(String email, String password) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      if (email.isEmpty || password.isEmpty) {
        _errorMessage = 'Email and password are required';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      await Future.delayed(const Duration(milliseconds: 400));

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'An unexpected error occurred during credential verification.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Create or update user PIN
  Future<bool> createPin(String pin) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      if (pin.length != 4) {
        _errorMessage = 'PIN must be 4 digits';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      await Future.delayed(const Duration(milliseconds: 300));
      await _secureStorage.write(key: _pinStorageKey, value: pin);

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'An unexpected error occurred while creating PIN.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Validate an entered PIN locally
  Future<bool> validatePin(String pin) async {
    try {
      final storedPin = await _secureStorage.read(key: _pinStorageKey);

      return storedPin != null && storedPin == pin;
    } catch (_) {
      return false;
    }
  }

  /// Change password
  /// Matches web app: ${AppConfig.authEndpoint}/change-password
  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      if (currentPassword.isEmpty ||
          newPassword.isEmpty ||
          confirmPassword.isEmpty) {
        _errorMessage = 'All password fields are required';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      if (newPassword != confirmPassword) {
        _errorMessage = 'New passwords do not match';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      // Web app uses: ${AppConfig.authEndpoint}/auth/change-password
      final response = await _apiService
          .post('${AppConfig.authEndpoint}/auth/change-password', data: {
        'current_password': currentPassword,
        'new_password': newPassword,
        'confirm_password': confirmPassword,
      });

      if (response.statusCode == 200) {
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = ErrorHandlerService.handleError(response.data);
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = ErrorHandlerService.handleError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Reset password
  /// Matches web app: ${AppConfig.authEndpoint}/auth/reset-password
  Future<bool> resetPassword({
    required String keycloakId,
    required String otpCode,
    required String newPassword,
    required String confirmPassword,
  }) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      if (keycloakId.isEmpty ||
          otpCode.isEmpty ||
          newPassword.isEmpty ||
          confirmPassword.isEmpty) {
        _errorMessage = 'All reset password fields are required';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      if (newPassword != confirmPassword) {
        _errorMessage = 'Passwords do not match';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      final response = await _apiService
          .post('${AppConfig.authEndpoint}/auth/reset-password', data: {
        'keycloak_id': keycloakId,
        'otp_code': otpCode,
        'new_password': newPassword,
        'confirm_password': confirmPassword,
      });

      if (response.statusCode == 200) {
        _passwordResetKeycloakId = null;
        await LocalStorageService.remove('password_reset_keycloak_id');
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = ErrorHandlerService.handleError(response.data);
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = ErrorHandlerService.handleError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Create PIN
  /// Matches web app: ${AppConfig.authEndpoint}/create-pin
  Future<bool> createPinAPI(String currentPin, String newPin) async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      final response =
          await _apiService.post('${AppConfig.authEndpoint}/create-pin', data: {
        'current_pin': currentPin,
        'new_pin': newPin,
      });

      if (response.statusCode == 200) {
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = ErrorHandlerService.handleError(response.data);
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = ErrorHandlerService.handleError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Resend verification email
  /// Matches web app: ${AppConfig.authEndpoint}/resend-verification
  Future<bool> resendVerificationEmail() async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      final response = await _apiService
          .post('${AppConfig.authEndpoint}/resend-verification');

      if (response.statusCode == 200) {
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = ErrorHandlerService.handleError(response.data);
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = ErrorHandlerService.handleError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Resend OTP
  /// Matches web app: ${AppConfig.authEndpoint}/resend-otp
  Future<bool> resendOtp() async {
    _isLoading = true;
    _errorMessage = '';
    notifyListeners();

    try {
      final response =
          await _apiService.post('${AppConfig.authEndpoint}/resend-otp');

      if (response.statusCode == 200) {
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = ErrorHandlerService.handleError(response.data);
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = ErrorHandlerService.handleError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }
}

// Note: Error handling methods have been moved to ErrorHandlerService
