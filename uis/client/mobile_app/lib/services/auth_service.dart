import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';
import '../models/user.dart';
import 'api_service.dart';
import 'user_service.dart';
import 'local_storage_service.dart';
import 'dart:convert';

class AuthService {
  final ApiService _apiService = ApiService();
  final UserService _userService = UserService();
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
      resetOnError: true,
    ),
  );

  // Login
  Future<User> login(String email, String password) async {
    final response = await _apiService.post(
      '${AppConfig.authEndpoint}/auth/login',
      data: {
        'email': email,
        'password': password,
      },
    );

    if (response.statusCode == 200) {
      final data = response.data;

      // Store tokens
      if (data['access_token'] != null) {
      await _storage.write(
        key: AppConfig.accessTokenKey,
        value: data['access_token'],
      );
      }
      if (data['refresh_token'] != null) {
      await _storage.write(
        key: AppConfig.refreshTokenKey,
        value: data['refresh_token'],
      );
      }

      // Get keycloak_id from response data (matching web app)
      String? keycloakId;
      // First try to get keycloak_id directly from response data
      keycloakId = data['keycloak_id']?.toString() ?? data['data']?['keycloak_id']?.toString();
      
      // If not in response, try to decode from token (fallback)
      if (keycloakId == null && data['access_token'] != null) {
        try {
          final tokenParts = (data['access_token'] as String).split('.');
          if (tokenParts.length == 3) {
            // Add padding if needed for base64 decoding
            String payloadBase64 = tokenParts[1];
            while (payloadBase64.length % 4 != 0) {
              payloadBase64 += '=';
            }
            final payloadBytes = base64Decode(payloadBase64);
            final payload = jsonDecode(utf8.decode(payloadBytes)) as Map<String, dynamic>;
            keycloakId = payload['sub'] ?? payload['keycloak_id'];
          }
        } catch (e) {
          print('Failed to decode token: $e');
        }
      }
      
      if (keycloakId != null) {
        // Store in LocalStorageService so API service can read it
        await LocalStorageService.setString('keycloak_id', keycloakId);
      }

      // Try to fetch user profile - but don't fail login if it doesn't exist yet
      if (keycloakId != null) {
        try {
          // Try getUserProfile first
          final user = await _userService.getUserProfile(keycloakId);
          await _storage.write(
            key: AppConfig.userDataKey,
            value: jsonEncode(user.toJson()),
          );
          return user;
        } catch (profileError) {
          print('User profile not found, trying alternative methods: $profileError');
          try {
            // Try getCurrentUser as fallback
            final user = await _userService.getCurrentUser(keycloakId);
            if (user != null) {
              await _storage.write(
                key: AppConfig.userDataKey,
                value: jsonEncode(user.toJson()),
              );
              return user;
            }
          } catch (currentUserError) {
            print('Failed to fetch user from getCurrentUser: $currentUserError');
          }
          
          // If both fail, return a minimal user object - login should still succeed
          print('User profile not available, creating minimal user object');
          final minimalUser = User.fromJson({
            'id': keycloakId,
            'email': email,
            'first_name': '',
            'last_name': '',
            'status': 'active',
            'is_verified': false,
            'created_at': DateTime.now().toIso8601String(),
          });
          await _storage.write(
            key: AppConfig.userDataKey,
            value: jsonEncode(minimalUser.toJson()),
          );
          return minimalUser;
        }
      }

      // If we can't decode keycloak_id, still allow login but with minimal user
      print('Could not extract keycloak_id from token, proceeding with minimal user');
      final minimalUser = User.fromJson({
        'id': email, // Use email as fallback ID
        'email': email,
        'first_name': '',
        'last_name': '',
        'status': 'active',
        'is_verified': false,
        'created_at': DateTime.now().toIso8601String(),
      });
      await _storage.write(
        key: AppConfig.userDataKey,
        value: jsonEncode(minimalUser.toJson()),
      );
      return minimalUser;
    } else {
      throw Exception('Login failed');
    }
  }

  // Register
  Future<User> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String phoneNumber,
  }) async {
    // Setup auth profile
    await _apiService.post(
      '${AppConfig.authEndpoint}/auth',
      data: {
        'email': email,
        'user_role': "user",
      },
    );

    // Setup password
    await _apiService.post(
      '${AppConfig.authEndpoint}/setup-password',
      data: {
        "password": password,
        "confirm_password": password,
      },
    );

    // Create user through user service
    final user = await _userService.createUser(
      email: email,
      password: password,
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phoneNumber,
    );

    return user;
  }

  // Get current user (delegates to UserService)
  Future<User?> getCurrentUser(String keycloakId) async {
    return await _userService.getCurrentUser(keycloakId);
  }

  // Get stored user (delegates to UserService)
  Future<User?> getStoredUser() async {
    return await _userService.getStoredUser();
  }

  // Logout
  Future<void> logout() async {
    try {
      await _apiService.post('${AppConfig.authEndpoint}/logout');
    } catch (e) {
      // Continue with local logout even if API call fails
    } finally {
      await _storage.deleteAll();
    }
  }

  // Check if user is authenticated
  Future<bool> isAuthenticated() async {
    final token = await _storage.read(key: AppConfig.accessTokenKey);
    return token != null && token.isNotEmpty;
  }

  // Forgot password
  Future<Map<String, dynamic>> forgotPassword(String email) async {
    final response = await _apiService.post(
      '${AppConfig.authEndpoint}/auth/forgot-password',
      data: {'email': email},
    );

    final data = response.data as Map<String, dynamic>;
    final keycloakId = data['keycloak_id']?.toString();
    if (keycloakId != null && keycloakId.isNotEmpty) {
      await LocalStorageService.setString('password_reset_keycloak_id', keycloakId);
    }

    return data;
  }

  // Reset password
  Future<void> resetPassword({
    required String keycloakId,
    required String otpCode,
    required String newPassword,
    required String confirmPassword,
  }) async {
    await _apiService.post(
      '${AppConfig.authEndpoint}/auth/reset-password',
      data: {
        'keycloak_id': keycloakId,
        'otp_code': otpCode,
        'new_password': newPassword,
        'confirm_password': confirmPassword,
      },
    );

    await LocalStorageService.remove('password_reset_keycloak_id');
  }

  // Change password
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    await _apiService.post(
      '${AppConfig.authEndpoint}/auth/change-password',
      data: {
        'current_password': currentPassword,
        'new_password': newPassword,
        'confirm_password': confirmPassword,
      },
    );
  }

  // Verify email
  Future<void> verifyEmail(String token) async {
    await _apiService.post(
      '${AppConfig.authEndpoint}/verify-email',
      data: {'token': token},
    );
  }

  // Resend verification email
  Future<void> resendVerificationEmail() async {
    await _apiService.post('${AppConfig.authEndpoint}/resend-verification');
  }
}
