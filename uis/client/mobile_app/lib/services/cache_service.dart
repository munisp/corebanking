import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;

/// SQLite-based offline cache for API responses.
/// Stores JSON responses keyed by endpoint path with TTL-based expiration.
class CacheService {
  static CacheService? _instance;
  Database? _db;

  CacheService._();

  static CacheService get instance {
    _instance ??= CacheService._();
    return _instance!;
  }

  Future<Database> get database async {
    _db ??= await _initDb();
    return _db!;
  }

  Future<Database> _initDb() async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, 'bank54_cache.db');
    return openDatabase(
      path,
      version: 2,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE IF NOT EXISTS api_cache (
            endpoint TEXT PRIMARY KEY,
            response TEXT NOT NULL,
            cached_at INTEGER NOT NULL,
            ttl_seconds INTEGER NOT NULL DEFAULT 300
          )
        ''');
        await db.execute('''
          CREATE TABLE IF NOT EXISTS offline_mutations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            method TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            body TEXT,
            created_at INTEGER NOT NULL,
            synced INTEGER NOT NULL DEFAULT 0
          )
        ''');
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await db.execute('''
            CREATE TABLE IF NOT EXISTS offline_mutations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              method TEXT NOT NULL,
              endpoint TEXT NOT NULL,
              body TEXT,
              created_at INTEGER NOT NULL,
              synced INTEGER NOT NULL DEFAULT 0
            )
          ''');
        }
      },
    );
  }

  /// Cache an API response with optional TTL (default 5 minutes).
  Future<void> cacheResponse(String endpoint, dynamic data, {int ttlSeconds = 300}) async {
    final db = await database;
    await db.insert(
      'api_cache',
      {
        'endpoint': endpoint,
        'response': jsonEncode(data),
        'cached_at': DateTime.now().millisecondsSinceEpoch,
        'ttl_seconds': ttlSeconds,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Get cached response if not expired. Returns null if cache miss or expired.
  Future<dynamic> getCachedResponse(String endpoint) async {
    final db = await database;
    final results = await db.query(
      'api_cache',
      where: 'endpoint = ?',
      whereArgs: [endpoint],
    );
    if (results.isEmpty) return null;
    final row = results.first;
    final cachedAt = row['cached_at'] as int;
    final ttl = row['ttl_seconds'] as int;
    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - cachedAt > ttl * 1000) {
      await db.delete('api_cache', where: 'endpoint = ?', whereArgs: [endpoint]);
      return null;
    }
    return jsonDecode(row['response'] as String);
  }

  /// Get cached response even if expired (for offline fallback).
  Future<dynamic> getCachedResponseForce(String endpoint) async {
    final db = await database;
    final results = await db.query(
      'api_cache',
      where: 'endpoint = ?',
      whereArgs: [endpoint],
    );
    if (results.isEmpty) return null;
    return jsonDecode(results.first['response'] as String);
  }

  /// Queue an offline mutation to be synced when back online.
  Future<void> queueMutation(String method, String endpoint, Map<String, dynamic>? body) async {
    final db = await database;
    await db.insert('offline_mutations', {
      'method': method,
      'endpoint': endpoint,
      'body': body != null ? jsonEncode(body) : null,
      'created_at': DateTime.now().millisecondsSinceEpoch,
      'synced': 0,
    });
  }

  /// Get all unsynced mutations.
  Future<List<Map<String, dynamic>>> getUnsyncedMutations() async {
    final db = await database;
    return db.query('offline_mutations', where: 'synced = 0', orderBy: 'created_at ASC');
  }

  /// Mark a mutation as synced.
  Future<void> markSynced(int id) async {
    final db = await database;
    await db.update('offline_mutations', {'synced': 1}, where: 'id = ?', whereArgs: [id]);
  }

  /// Get count of pending mutations.
  Future<int> pendingMutationCount() async {
    final db = await database;
    final result = await db.rawQuery('SELECT COUNT(*) as count FROM offline_mutations WHERE synced = 0');
    return Sqflite.firstIntValue(result) ?? 0;
  }

  /// Clear all caches.
  Future<void> clearAll() async {
    final db = await database;
    await db.delete('api_cache');
    await db.delete('offline_mutations');
  }

  /// Clear expired cache entries.
  Future<void> clearExpired() async {
    final db = await database;
    final now = DateTime.now().millisecondsSinceEpoch;
    await db.rawDelete(
      'DELETE FROM api_cache WHERE (? - cached_at) > (ttl_seconds * 1000)',
      [now],
    );
  }
}
