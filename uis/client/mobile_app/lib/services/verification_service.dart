import 'api_service.dart';

/// Service for verifying NIN, BVN, and phone numbers
/// Uses mock responses for now - endpoints will be added later
class VerificationService {
  final ApiService _apiService = ApiService();

  /// Verify NIN (National Identification Number)
  /// NIN is 11 digits in Nigeria
  /// Returns verification result with user details if valid
  Future<Map<String, dynamic>> verifyNIN(String nin) async {
    try {
      // Validate format first
      if (nin.length != 11 || !RegExp(r'^\d{11}$').hasMatch(nin)) {
        return {
          'success': false,
          'message': 'NIN must be 11 digits',
          'valid': false,
        };
      }

      return {
        'success': true,
        'valid': true,
        'message': 'NIN format valid',
      };
    } catch (e) {
      return {
        'success': false,
        'valid': false,
        'message': 'Error verifying NIN: ${e.toString()}',
      };
    }
  }

  /// Verify BVN (Bank Verification Number)
  /// BVN is 11 digits in Nigeria
  /// Returns verification result with bank account details if valid
  Future<Map<String, dynamic>> verifyBVN(String bvn) async {
    try {
      // Validate format first
      if (bvn.length != 11 || !RegExp(r'^\d{11}$').hasMatch(bvn)) {
        return {
          'success': false,
          'message': 'BVN must be 11 digits',
          'valid': false,
        };
      }

      return {
        'success': true,
        'valid': true,
        'message': 'BVN format valid',
      };
    } catch (e) {
      return {
        'success': false,
        'valid': false,
        'message': 'Error verifying BVN: ${e.toString()}',
      };
    }
  }

  /// Verify phone number
  /// Validates Nigerian phone number format and checks if it's registered
  /// Returns verification result
  Future<Map<String, dynamic>> verifyPhoneNumber(String phoneNumber) async {
    try {
      // Clean phone number (remove spaces, dashes, etc.)
      final cleanedPhone = phoneNumber.replaceAll(RegExp(r'[\s\-\(\)]'), '');

      // Validate Nigerian phone number format
      // Nigerian numbers: +234XXXXXXXXXX or 0XXXXXXXXXX or 234XXXXXXXXXX
      final phoneRegex = RegExp(r'^(\+?234|0)?[789]\d{9}$');
      if (!phoneRegex.hasMatch(cleanedPhone)) {
        return {
          'success': false,
          'valid': false,
          'message': 'Invalid phone number format. Please enter a valid Nigerian phone number.',
        };
      }

      // Normalize phone number to +234 format
      String normalizedPhone = cleanedPhone;
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '+234${normalizedPhone.substring(1)}';
      } else if (normalizedPhone.startsWith('234')) {
        normalizedPhone = '+$normalizedPhone';
      } else if (!normalizedPhone.startsWith('+234')) {
        normalizedPhone = '+234$normalizedPhone';
      }

      return {
        'success': true,
        'valid': true,
        'message': 'Phone number valid',
        'phoneNumber': normalizedPhone,
      };
    } catch (e) {
      return {
        'success': false,
        'valid': false,
        'message': 'Error verifying phone number: ${e.toString()}',
      };
    }
  }
}

