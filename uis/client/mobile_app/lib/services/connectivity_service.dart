import 'package:flutter/foundation.dart';

enum ConnectionQuality { excellent, good, poor, minimal, offline }

class ConnectivityService extends ChangeNotifier {
  bool _isOnline = true;
  ConnectionQuality _quality = ConnectionQuality.good;
  double _bandwidthKbps = 256.0;

  bool get isOnline => _isOnline;
  ConnectionQuality get quality => _quality;
  double get bandwidthKbps => _bandwidthKbps;
  String get qualityLabel => _quality.name;

  void updateStatus({required bool isOnline, double? bandwidthKbps}) {
    _isOnline = isOnline;
    if (bandwidthKbps != null) _bandwidthKbps = bandwidthKbps;
    _quality = _classify();
    notifyListeners();
  }

  ConnectionQuality _classify() {
    if (!_isOnline) return ConnectionQuality.offline;
    if (_bandwidthKbps >= 1024) return ConnectionQuality.excellent;
    if (_bandwidthKbps >= 256) return ConnectionQuality.good;
    if (_bandwidthKbps >= 64) return ConnectionQuality.poor;
    if (_bandwidthKbps >= 9.6) return ConnectionQuality.minimal;
    return ConnectionQuality.offline;
  }

  int get recommendedBatchSize {
    switch (_quality) {
      case ConnectionQuality.excellent: return 50;
      case ConnectionQuality.good: return 20;
      case ConnectionQuality.poor: return 5;
      case ConnectionQuality.minimal: return 1;
      case ConnectionQuality.offline: return 0;
    }
  }
}
