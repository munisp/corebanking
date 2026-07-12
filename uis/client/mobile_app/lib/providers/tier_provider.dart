import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

enum TierLevel { tier1, tier2, tier3 }

class TierStatus {
  final TierLevel tier;
  final bool hasBVN;
  final bool hasDocuments;
  final bool hasAddress;
  final bool hasFaceVerification;

  TierStatus({
    required this.tier,
    required this.hasBVN,
    required this.hasDocuments,
    required this.hasAddress,
    required this.hasFaceVerification,
  });

  Map<String, dynamic> toJson() {
    return {
      'tier': tier.index + 1,
      'hasBVN': hasBVN,
      'hasDocuments': hasDocuments,
      'hasAddress': hasAddress,
      'hasFaceVerification': hasFaceVerification,
    };
  }

  factory TierStatus.fromJson(Map<String, dynamic> json) {
    return TierStatus(
      tier: TierLevel.values[(json['tier'] as int) - 1],
      hasBVN: json['hasBVN'] as bool,
      hasDocuments: json['hasDocuments'] as bool,
      hasAddress: json['hasAddress'] as bool,
      hasFaceVerification: json['hasFaceVerification'] as bool,
    );
  }

  TierStatus copyWith({
    TierLevel? tier,
    bool? hasBVN,
    bool? hasDocuments,
    bool? hasAddress,
    bool? hasFaceVerification,
  }) {
    return TierStatus(
      tier: tier ?? this.tier,
      hasBVN: hasBVN ?? this.hasBVN,
      hasDocuments: hasDocuments ?? this.hasDocuments,
      hasAddress: hasAddress ?? this.hasAddress,
      hasFaceVerification: hasFaceVerification ?? this.hasFaceVerification,
    );
  }
}

class TierInfo {
  final String name;
  final String description;
  final int colorValue;

  TierInfo({
    required this.name,
    required this.description,
    required this.colorValue,
  });
}

class TierProvider with ChangeNotifier {
  TierStatus _tierStatus = TierStatus(
    tier: TierLevel.tier1,
    hasBVN: false,
    hasDocuments: false,
    hasAddress: false,
    hasFaceVerification: false,
  );

  TierStatus get tierStatus => _tierStatus;

  TierProvider() {
    _loadTierStatus();
  }

  Future<void> _loadTierStatus() async {
    final prefs = await SharedPreferences.getInstance();
    final tierJson = prefs.getString('tierStatus');
    if (tierJson != null) {
      final Map<String, dynamic> json = jsonDecode(tierJson);
      _tierStatus = TierStatus.fromJson(json);
      notifyListeners();
    }
  }

  Future<void> _saveTierStatus() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('tierStatus', jsonEncode(_tierStatus.toJson()));
  }

  Future<void> updateTierStatus({
    bool? hasBVN,
    bool? hasDocuments,
    bool? hasAddress,
    bool? hasFaceVerification,
  }) async {
    _tierStatus = _tierStatus.copyWith(
      hasBVN: hasBVN,
      hasDocuments: hasDocuments,
      hasAddress: hasAddress,
      hasFaceVerification: hasFaceVerification,
    );

    // Auto-upgrade tier based on completed verifications
    if (_tierStatus.hasBVN &&
        _tierStatus.hasDocuments &&
        _tierStatus.hasFaceVerification &&
        _tierStatus.tier == TierLevel.tier1) {
      _tierStatus = _tierStatus.copyWith(tier: TierLevel.tier2);
    }

    if (_tierStatus.tier == TierLevel.tier2 && _tierStatus.hasAddress) {
      _tierStatus = _tierStatus.copyWith(tier: TierLevel.tier3);
    }

    await _saveTierStatus();
    notifyListeners();
  }

  Future<void> upgradeTier() async {
    if (_tierStatus.tier == TierLevel.tier1) {
      _tierStatus = _tierStatus.copyWith(tier: TierLevel.tier2);
    } else if (_tierStatus.tier == TierLevel.tier2) {
      _tierStatus = _tierStatus.copyWith(tier: TierLevel.tier3);
    }

    await _saveTierStatus();
    notifyListeners();
  }

  Future<void> resetTier() async {
    _tierStatus = TierStatus(
      tier: TierLevel.tier1,
      hasBVN: false,
      hasDocuments: false,
      hasAddress: false,
      hasFaceVerification: false,
    );
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('tierStatus');
    notifyListeners();
  }

  TierInfo getTierInfo() {
    switch (_tierStatus.tier) {
      case TierLevel.tier1:
        return TierInfo(
          name: 'Basic',
          description: 'Complete your profile to unlock more features',
          colorValue: 0xFF9E9E9E, // gray
        );
      case TierLevel.tier2:
        return TierInfo(
          name: 'Verified',
          description: 'Your identity has been verified',
          colorValue: 0xFF2196F3, // blue
        );
      case TierLevel.tier3:
        return TierInfo(
          name: 'Full Access',
          description: 'All features unlocked',
          colorValue: 0xFF4CAF50, // green
        );
    }
  }
}
