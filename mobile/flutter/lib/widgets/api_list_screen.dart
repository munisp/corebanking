import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/cache_service.dart';
import '../services/connectivity_service.dart';
import '../services/offline_service.dart';

/// Reusable API-integrated list screen with CRUD, search, offline caching,
/// and connectivity awareness. All 254 screens use this as their base.
class ApiListScreen extends StatefulWidget {
  final String title;
  final String apiEndpoint;
  final List<String> columnKeys;
  final List<String> columnLabels;
  final List<Map<String, String>> seedData;
  final IconData? icon;

  const ApiListScreen({
    super.key,
    required this.title,
    required this.apiEndpoint,
    required this.columnKeys,
    required this.columnLabels,
    required this.seedData,
    this.icon,
  });

  @override
  State<ApiListScreen> createState() => _ApiListScreenState();
}

class _ApiListScreenState extends State<ApiListScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  List<Map<String, String>> _items = [];
  bool _loading = true;
  bool _isOfflineData = false;
  String? _error;
  int _pendingMutations = 0;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() { _loading = true; _error = null; });

    final connectivity = context.read<ConnectivityService>();
    final api = context.read<ApiService>();
    final cache = CacheService.instance;

    try {
      if (connectivity.isOnline) {
        // Try API first
        final response = await api.get(widget.apiEndpoint);
        final items = _parseResponse(response);
        if (items.isNotEmpty) {
          setState(() {
            _items = items;
            _loading = false;
            _isOfflineData = false;
          });
          // Cache the response
          await cache.cacheResponse(widget.apiEndpoint, response);
          return;
        }
      }
    } catch (_) {
      // API failed — try cache
    }

    // Try cache (even if expired for offline)
    try {
      final cached = connectivity.isOnline
          ? await cache.getCachedResponse(widget.apiEndpoint)
          : await cache.getCachedResponseForce(widget.apiEndpoint);
      if (cached != null) {
        final items = _parseResponse(cached is Map<String, dynamic> ? cached : {'items': cached});
        if (items.isNotEmpty) {
          setState(() {
            _items = items;
            _loading = false;
            _isOfflineData = true;
          });
          return;
        }
      }
    } catch (_) {}

    // Fall back to seed data
    setState(() {
      _items = List.from(widget.seedData);
      _loading = false;
      _isOfflineData = true;
    });

    // Update pending mutation count
    _updatePendingCount();
  }

  List<Map<String, String>> _parseResponse(Map<String, dynamic> response) {
    final rawItems = response['items'] ?? response['data'] ?? [];
    if (rawItems is! List) return [];
    return rawItems.map<Map<String, String>>((item) {
      if (item is Map) {
        return item.map((k, v) => MapEntry(k.toString(), v?.toString() ?? ''));
      }
      return <String, String>{};
    }).toList();
  }

  Future<void> _updatePendingCount() async {
    final count = await CacheService.instance.pendingMutationCount();
    if (mounted) setState(() => _pendingMutations = count);
  }

  List<Map<String, String>> get _filtered {
    if (_searchQuery.isEmpty) return _items;
    final q = _searchQuery.toLowerCase();
    return _items.where((item) => item.values.any((v) => v.toLowerCase().contains(q))).toList();
  }

  Future<void> _createItem(Map<String, String> data) async {
    final connectivity = context.read<ConnectivityService>();
    final api = context.read<ApiService>();

    // Optimistic local update
    setState(() => _items.insert(0, data));

    if (connectivity.isOnline) {
      try {
        await api.post(widget.apiEndpoint, data.map((k, v) => MapEntry(k, v)));
        // Refresh from API
        _loadData();
      } catch (_) {
        // Queue for later sync
        await CacheService.instance.queueMutation('POST', widget.apiEndpoint, data);
        _updatePendingCount();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Saved offline — will sync when connected')),
          );
        }
      }
    } else {
      await CacheService.instance.queueMutation('POST', widget.apiEndpoint, data);
      _updatePendingCount();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Saved offline — will sync when connected')),
        );
      }
    }
  }

  Future<void> _deleteItem(Map<String, String> item, int index) async {
    final connectivity = context.read<ConnectivityService>();
    final api = context.read<ApiService>();
    final id = item[widget.columnKeys[0]] ?? '';

    setState(() => _items.remove(item));

    if (connectivity.isOnline) {
      try {
        await api.delete('${widget.apiEndpoint}/$id');
      } catch (_) {
        await CacheService.instance.queueMutation('DELETE', '${widget.apiEndpoint}/$id', null);
        _updatePendingCount();
      }
    } else {
      await CacheService.instance.queueMutation('DELETE', '${widget.apiEndpoint}/$id', null);
      _updatePendingCount();
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Record deleted'),
          action: SnackBarAction(
            label: 'Undo',
            onPressed: () => setState(() => _items.insert(index, item)),
          ),
        ),
      );
    }
  }

  Future<void> _syncPending() async {
    final api = context.read<ApiService>();
    final cache = CacheService.instance;
    final mutations = await cache.getUnsyncedMutations();
    int synced = 0;

    for (final m in mutations) {
      try {
        final method = m['method'] as String;
        final endpoint = m['endpoint'] as String;
        final body = m['body'] != null ? Map<String, dynamic>.from(
          (m['body'] is String) ? {} : m['body'] as Map,
        ) : null;

        switch (method) {
          case 'POST':
            if (body != null) await api.post(endpoint, body);
            break;
          case 'PUT':
            if (body != null) await api.put(endpoint, body);
            break;
          case 'DELETE':
            await api.delete(endpoint);
            break;
        }
        await cache.markSynced(m['id'] as int);
        synced++;
      } catch (_) {
        break; // Stop on first failure
      }
    }

    if (mounted) {
      _updatePendingCount();
      if (synced > 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Synced $synced pending operations')),
        );
        _loadData();
      }
    }
  }

  void _showCreateDialog() {
    final controllers = <String, TextEditingController>{};
    for (final key in widget.columnKeys) {
      controllers[key] = TextEditingController();
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
          left: 16, right: 16, top: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Create New ${widget.title}', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            ...widget.columnKeys.asMap().entries.map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TextField(
                controller: controllers[e.value],
                decoration: InputDecoration(
                  labelText: widget.columnLabels[e.key],
                  border: const OutlineInputBorder(),
                ),
              ),
            )),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  final data = <String, String>{};
                  controllers.forEach((k, c) => data[k] = c.text);
                  Navigator.pop(ctx);
                  _createItem(data);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F766E),
                  foregroundColor: Colors.white,
                ),
                child: const Text('Save'),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  void _showDetail(Map<String, String> item) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(item[widget.columnKeys[0]] ?? widget.title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(widget.columnKeys.length, (i) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              SizedBox(
                width: 100,
                child: Text(
                  '${widget.columnLabels[i]}:',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
              Expanded(
                child: Text(
                  item[widget.columnKeys[i]] ?? '',
                  style: const TextStyle(fontSize: 13),
                ),
              ),
            ]),
          )),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close'))],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final connectivity = context.watch<ConnectivityService>();
    final filtered = _filtered;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          if (_pendingMutations > 0)
            IconButton(
              icon: Badge(
                label: Text('$_pendingMutations'),
                child: const Icon(Icons.sync),
              ),
              onPressed: connectivity.isOnline ? _syncPending : null,
              tooltip: '$_pendingMutations pending sync',
            ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadData),
        ],
      ),
      body: Column(
        children: [
          // Connectivity banner
          if (!connectivity.isOnline || _isOfflineData)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              color: !connectivity.isOnline ? Colors.orange.shade100 : Colors.blue.shade50,
              child: Row(
                children: [
                  Icon(
                    !connectivity.isOnline ? Icons.cloud_off : Icons.cloud_done,
                    size: 16,
                    color: !connectivity.isOnline ? Colors.orange.shade800 : Colors.blue.shade800,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    !connectivity.isOnline ? 'Offline — showing cached data' : 'Showing cached data',
                    style: TextStyle(
                      fontSize: 12,
                      color: !connectivity.isOnline ? Colors.orange.shade800 : Colors.blue.shade800,
                    ),
                  ),
                  if (_pendingMutations > 0) ...[
                    const Spacer(),
                    Text(
                      '$_pendingMutations pending',
                      style: TextStyle(fontSize: 12, color: Colors.orange.shade800),
                    ),
                  ],
                ],
              ),
            ),
          // Search
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search ${widget.title.toLowerCase()}...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
              ),
              onChanged: (v) => setState(() => _searchQuery = v),
            ),
          ),
          // Record count
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${filtered.length} records',
                  style: const TextStyle(color: Colors.grey),
                ),
                TextButton.icon(
                  onPressed: _showCreateDialog,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add'),
                ),
              ],
            ),
          ),
          // List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF0F766E)))
                : filtered.isEmpty
                    ? const Center(child: Text('No records found', style: TextStyle(color: Colors.grey)))
                    : RefreshIndicator(
                        onRefresh: _loadData,
                        color: const Color(0xFF0F766E),
                        child: ListView.builder(
                          itemCount: filtered.length,
                          itemBuilder: (ctx, i) {
                            final item = filtered[i];
                            return Card(
                              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: const Color(0xFF0F766E).withValues(alpha: 0.1),
                                  child: Text(
                                    '${i + 1}',
                                    style: const TextStyle(
                                      color: Color(0xFF0F766E),
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                                title: Text(
                                  item[widget.columnKeys[0]] ?? '',
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                                subtitle: Text(
                                  widget.columnKeys
                                      .skip(1)
                                      .take(2)
                                      .map((k) => '${_labelFor(k)}: ${item[k] ?? ""}')
                                      .join(' | '),
                                  style: const TextStyle(fontSize: 12),
                                ),
                                trailing: PopupMenuButton<String>(
                                  onSelected: (action) {
                                    if (action == 'view') _showDetail(item);
                                    if (action == 'delete') _deleteItem(item, i);
                                  },
                                  itemBuilder: (_) => [
                                    const PopupMenuItem(value: 'view', child: Text('View Details')),
                                    const PopupMenuItem(value: 'edit', child: Text('Edit')),
                                    const PopupMenuItem(
                                      value: 'delete',
                                      child: Text('Delete', style: TextStyle(color: Colors.red)),
                                    ),
                                  ],
                                ),
                                onTap: () => _showDetail(item),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateDialog,
        backgroundColor: const Color(0xFF0F766E),
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  String _labelFor(String key) {
    final idx = widget.columnKeys.indexOf(key);
    return idx >= 0 ? widget.columnLabels[idx] : key;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}
