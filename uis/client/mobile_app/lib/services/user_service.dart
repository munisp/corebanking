import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile_app/services/local_storage_service.dart';
import '../config/app_config.dart';
import '../models/user.dart';
import 'api_service.dart';
import 'dart:convert';

class UserService {
  final ApiService _apiService = ApiService();
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
      resetOnError: true,
    ),
  );

  // Get current user from API
  // Matches web app: ${AppConfig.userEndpoint}/user?keycloak_id=${keycloakId}
  Future<User?> getCurrentUser(String keycloakId) async {
    try {
      final response = await _apiService.get('${AppConfig.userEndpoint}/user?keycloak_id=$keycloakId');

      if (response.statusCode == 200) {
        final user = User.fromJson(response.data['user']);

        // Update stored user data
        await _storage.write(
          key: AppConfig.userDataKey,
          value: jsonEncode(user.toJson()),
        );

        // Fetch and store account data
        try {
          final accountResponse = await _apiService.get('${AppConfig.accountEndpoint}/keycloak_id=$keycloakId');
          
          if (accountResponse.statusCode == 200) {
            final accountData = accountResponse.data['account'];
            
            // Store account data
            await _storage.write(
              key: 'account',
              value: jsonEncode(accountData),
            );
            
            // Store account ID separately
            if (accountData['id'] != null) {
              await _storage.write(
                key: 'account_id',
                value: accountData['id'].toString(),
              );
            }
          }
        } catch (e) {
          // Continue even if account fetch fails
          print('Failed to fetch account data: $e');
        }

        return user;
      }
      return null;
    } catch (e) {
      // Try to get from storage
      final userData = await _storage.read(key: AppConfig.userDataKey);
      if (userData != null) {
        return User.fromJson(jsonDecode(userData));
      }
      return null;
    }
  }

  // Get stored user from local storage
  Future<User?> getStoredUser() async {
    final userData = await _storage.read(key: AppConfig.userDataKey);
    if (userData != null) {
      return User.fromJson(jsonDecode(userData));
    }
    return null;
  }

  Future<User?> getStoredUserII() async {
    final userData = await LocalStorageService.getString( AppConfig.userDataKey);
    if (userData != null) {
      return User.fromJson(jsonDecode(userData));
    }
    return null;
  }

  // Get stored account from local storage
  Future<Map<String, dynamic>?> getStoredAccount() async {
    final accountData = await _storage.read(key: 'account');
    if (accountData != null) {
      return jsonDecode(accountData);
    }
    return null;
  }

  // Get stored account ID
  Future<String?> getStoredAccountId() async {
    return await _storage.read(key: 'account_id');
  }

  // Get user profile
  // Matches web app: ${AppConfig.userEndpoint}/user?keycloak_id=${keycloakId}
  Future<User> getUserProfile(String keycloakId) async {
    final response = await _apiService.get('${AppConfig.userEndpoint}/user?keycloak_id=$keycloakId');

    // Fetch and store account data
        try {
          final accountResponse = await _apiService.get('${AppConfig.accountEndpoint}/keycloak_id=$keycloakId');
          
          if (accountResponse.statusCode == 200) {
            final accountData = accountResponse.data['account'];
            
            // Store account data
            await _storage.write(
              key: 'account',
              value: jsonEncode(accountData),
            );
            
            // Store account ID separately
            if (accountData['id'] != null) {
              await _storage.write(
                key: 'account_id',
                value: accountData['id'].toString(),
              );
            }
          }
        } catch (e) {
          // Continue even if account fetch fails
          print('Failed to fetch account data: $e');
        }

    if (response.statusCode == 200) {
      final user = User.fromJson(response.data['user']);

      // Update stored user data
      await _storage.write(
        key: AppConfig.userDataKey,
        value: jsonEncode(user.toJson()),
      );

      return user;
    } else {
      throw Exception('Failed to fetch user profile');
    }
  }

  // Update user profile
  Future<User> updateUserProfile({
    String? firstName,
    String? lastName,
    String? phoneNumber,
    String? email,
    String? address,
    String? city,
    String? state,
    String? country,
    String? postalCode,
    String? dateOfBirth,
    String? keycloakId,
  }) async {
    final data = <String, dynamic>{};
    if (firstName != null) data['first_name'] = firstName;
    if (lastName != null) data['last_name'] = lastName;
    if (phoneNumber != null) data['phone_number'] = phoneNumber;
    if (email != null) data['email'] = email;
    if (address != null) data['address'] = address;
    if (city != null) data['city'] = city;
    if (state != null) data['state'] = state;
    if (country != null) data['country'] = country;
    if (postalCode != null) data['postal_code'] = postalCode;
    if (dateOfBirth != null) data['date_of_birth'] = dateOfBirth;

    final response = await _apiService.put(
      '${AppConfig.authEndpoint}/user?keycloak_id=$keycloakId',
      data: data,
    );

    if (response.statusCode == 200) {
      final user = User.fromJson(response.data['user']);

      // Update stored user data
      await _storage.write(
        key: AppConfig.userDataKey,
        value: jsonEncode(user.toJson()),
      );

      return user;
    } else {
      throw Exception('Failed to update user profile');
    }
  }

  // Create user (during registration)
  Future<User> createUser({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String phoneNumber,
    String? uin,
  }) async {
    final response = await _apiService.post(
      '${AppConfig.userEndpoint}/user',
      data: {
        'email': email,
        'password': password,
        'first_name': firstName,
        'last_name': lastName,
        'phone_number': phoneNumber,
        'uin': uin,
      },
    );

    if (response.statusCode == 201 || response.statusCode == 200) {
      final data = response.data['data'];
      final user = User.fromJson(data['user'] ?? data);

      // Store user data
      await _storage.write(
        key: AppConfig.userDataKey,
        value: jsonEncode(user.toJson()),
      );

      return user;
    } else {
      throw Exception('Failed to create user');
    }
  }

  // Delete user account
  Future<void> deleteAccount() async {
    final response = await _apiService.delete('${AppConfig.userEndpoint}/account');

    if (response.statusCode != 200 && response.statusCode != 204) {
      throw Exception('Failed to delete account');
    }

    // Clear all stored data
    await _storage.deleteAll();
  }

  // Update user preferences
  Future<void> updatePreferences(Map<String, dynamic> preferences) async {
    final response = await _apiService.put(
      '${AppConfig.userEndpoint}/preferences',
      data: preferences,
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to update preferences');
    }
  }

  // Get user preferences
  Future<Map<String, dynamic>> getPreferences() async {
    final response = await _apiService.get('${AppConfig.userEndpoint}/preferences');

    if (response.statusCode == 200) {
      return response.data['data'] ?? {};
    } else {
      throw Exception('Failed to fetch preferences');
    }
  }

  // Upload profile picture
  Future<String> uploadProfilePicture(String filePath) async {
    // This would typically use FormData for file upload
    final response = await _apiService.post(
      '${AppConfig.userEndpoint}/profile/picture',
      data: {
        'file_path': filePath,
      },
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = response.data['data'];
      return data['url'] ?? data['profile_picture_url'] ?? '';
    } else {
      throw Exception('Failed to upload profile picture');
    }
  }

  // Get user notifications settings
  Future<Map<String, dynamic>> getNotificationSettings() async {
    final response = await _apiService.get('${AppConfig.userEndpoint}/notifications/settings');

    if (response.statusCode == 200) {
      return response.data['data'] ?? {};
    } else {
      throw Exception('Failed to fetch notification settings');
    }
  }

  // Update notification settings
  Future<void> updateNotificationSettings(Map<String, dynamic> settings) async {
    final response = await _apiService.put(
      '${AppConfig.userEndpoint}/notifications/settings',
      data: settings,
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to update notification settings');
    }
  }
}