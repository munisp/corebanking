import 'package:local_auth/local_auth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

class BiometricService {
  final LocalAuthentication _localAuth = LocalAuthentication();
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
      resetOnError: true,
    ),
  );

  // Check if biometric authentication is available
  Future<bool> isBiometricAvailable() async {
    try {
      return await _localAuth.canCheckBiometrics;
    } catch (e) {
      return false;
    }
  }

  // Get available biometric types
  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _localAuth.getAvailableBiometrics();
    } catch (e) {
      return [];
    }
  }

  // Check if device supports biometrics
  Future<bool> isDeviceSupported() async {
    try {
      return await _localAuth.isDeviceSupported();
    } catch (e) {
      return false;
    }
  }

  // Authenticate with biometrics
  Future<bool> authenticate({
    String localizedReason = 'Please authenticate to access your account',
    bool useErrorDialogs = true,
    bool stickyAuth = true,
  }) async {
    try {
      final isAvailable = await isBiometricAvailable();
      if (!isAvailable) return false;

      return await _localAuth.authenticate(
        localizedReason: localizedReason,
        options: AuthenticationOptions(
          stickyAuth: stickyAuth,
          biometricOnly: true,
          useErrorDialogs: useErrorDialogs,
        ),
      );
    } catch (e) {
      return false;
    }
  }

  // Check if biometric is enabled for this app
  Future<bool> isBiometricEnabled() async {
    final enabled = await _storage.read(key: AppConfig.biometricEnabledKey);
    return enabled == 'true';
  }

  // Enable biometric authentication
  Future<void> enableBiometric() async {
    await _storage.write(key: AppConfig.biometricEnabledKey, value: 'true');
  }

  // Disable biometric authentication
  Future<void> disableBiometric() async {
    await _storage.write(key: AppConfig.biometricEnabledKey, value: 'false');
  }

  // Get biometric type name
  String getBiometricTypeName(List<BiometricType> biometrics) {
    if (biometrics.contains(BiometricType.face)) {
      return 'Face ID';
    } else if (biometrics.contains(BiometricType.fingerprint)) {
      return 'Fingerprint';
    } else if (biometrics.contains(BiometricType.iris)) {
      return 'Iris';
    } else if (biometrics.contains(BiometricType.strong)) {
      return 'Biometric';
    } else if (biometrics.contains(BiometricType.weak)) {
      return 'Biometric';
    }
    return 'Biometric';
  }
}
