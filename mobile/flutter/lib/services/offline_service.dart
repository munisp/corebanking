import 'dart:convert';

/// Offline queue for operations when device has no connectivity.
/// Queued operations are stored in SharedPreferences and replayed when online.
class OfflineService {
  final List<Map<String, dynamic>> _queue = [];

  List<Map<String, dynamic>> get pendingOperations => List.unmodifiable(_queue);
  int get pendingCount => _queue.length;

  void enqueue({
    required String method,
    required String endpoint,
    Map<String, dynamic>? body,
    int priority = 3,
  }) {
    _queue.add({
      'id': DateTime.now().millisecondsSinceEpoch.toString(),
      'method': method,
      'endpoint': endpoint,
      'body': body,
      'priority': priority,
      'createdAt': DateTime.now().toIso8601String(),
    });
    _queue.sort((a, b) => (a['priority'] as int).compareTo(b['priority'] as int));
  }

  Map<String, dynamic>? dequeue() {
    if (_queue.isEmpty) return null;
    return _queue.removeAt(0);
  }

  void clear() => _queue.clear();

  String serialize() => jsonEncode(_queue);

  void deserialize(String data) {
    _queue.clear();
    final list = jsonDecode(data) as List;
    _queue.addAll(list.cast<Map<String, dynamic>>());
  }
}
