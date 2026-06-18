import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/user_service.dart';

class UserProvider with ChangeNotifier {
  final UserService _userService = UserService();

  User? _currentUser;
  Map<String, dynamic> _preferences = {};
  Map<String, dynamic> _notificationSettings = {};
  bool _isLoading = false;
  bool _isProcessing = false;
  String? _errorMessage;

  User? get currentUser => _currentUser;
  Map<String, dynamic> get preferences => _preferences;
  Map<String, dynamic> get notificationSettings => _notificationSettings;
  bool get isLoading => _isLoading;
  bool get isProcessing => _isProcessing;
  String? get errorMessage => _errorMessage;

  // Get user profile
  Future<void> fetchUserProfile() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _currentUser = await _userService.getUserProfile(_currentUser?.id ?? '');
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  // Update user profile
  Future<bool> updateProfile({
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
  }) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _currentUser = await _userService.updateUserProfile(
        firstName: firstName,
        lastName: lastName,
        phoneNumber: phoneNumber,
        email: email,
        address: address,
        city: city,
        state: state,
        country: country,
        postalCode: postalCode,
        dateOfBirth: dateOfBirth,
      );
      _isProcessing = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isProcessing = false;
      notifyListeners();
      return false;
    }
  }

  // Upload profile picture
  Future<String?> uploadProfilePicture(String filePath) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final url = await _userService.uploadProfilePicture(filePath);
      _isProcessing = false;
      notifyListeners();
      return url;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isProcessing = false;
      notifyListeners();
      return null;
    }
  }

  // Get preferences
  Future<void> fetchPreferences() async {
    try {
      _preferences = await _userService.getPreferences();
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
    }
  }

  // Update preferences
  Future<bool> updatePreferences(Map<String, dynamic> preferences) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _userService.updatePreferences(preferences);
      _preferences = preferences;
      _isProcessing = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isProcessing = false;
      notifyListeners();
      return false;
    }
  }

  // Get notification settings
  Future<void> fetchNotificationSettings() async {
    try {
      _notificationSettings = await _userService.getNotificationSettings();
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
    }
  }

  // Update notification settings
  Future<bool> updateNotificationSettings(Map<String, dynamic> settings) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _userService.updateNotificationSettings(settings);
      _notificationSettings = settings;
      _isProcessing = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isProcessing = false;
      notifyListeners();
      return false;
    }
  }

  // Delete account
  Future<bool> deleteAccount() async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _userService.deleteAccount();
      _currentUser = null;
      _preferences = {};
      _notificationSettings = {};
      _isProcessing = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isProcessing = false;
      notifyListeners();
      return false;
    }
  }

  // Get stored user
  Future<void> loadStoredUser() async {
    try {
      _currentUser = await _userService.getStoredUser();
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
    }
  }

  // Set current user
  void setCurrentUser(User user) {
    _currentUser = user;
    notifyListeners();
  }

  // Clear current user
  void clearUser() {
    _currentUser = null;
    _preferences = {};
    _notificationSettings = {};
    notifyListeners();
  }

  // Clear error message
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
