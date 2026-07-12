import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../../../config/app_config.dart';

class CrudScaffold extends StatefulWidget {
  final String title;
  final String apiPath;

  const CrudScaffold({super.key, required this.title, required this.apiPath});

  @override
  State<CrudScaffold> createState() => _CrudScaffoldState();
}

class _CrudScaffoldState extends State<CrudScaffold> {
  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchItems();
  }

  Future<void> _fetchItems() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await Dio().get('${AppConfig.baseUrl}${widget.apiPath}');
      final data = response.data;
      setState(() {
        _items = data is List ? data : (data['data'] ?? data['items'] ?? []);
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchItems,
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Failed to load data', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            ElevatedButton(onPressed: _fetchItems, child: const Text('Retry')),
          ],
        ),
      );
    }
    if (_items.isEmpty) {
      return const Center(child: Text('No records found.'));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _items.length,
      separatorBuilder: (_, __) => const Divider(),
      itemBuilder: (context, index) {
        final item = _items[index];
        if (item is Map) {
          final title = item['name'] ?? item['title'] ?? item['id']?.toString() ?? 'Item ${index + 1}';
          final subtitle = item['description'] ?? item['status'] ?? '';
          return ListTile(
            title: Text(title.toString()),
            subtitle: subtitle.toString().isNotEmpty ? Text(subtitle.toString()) : null,
          );
        }
        return ListTile(title: Text(item.toString()));
      },
    );
  }
}
