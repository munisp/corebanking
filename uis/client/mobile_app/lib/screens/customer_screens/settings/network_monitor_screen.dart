
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../../../l10n/app_localizations.dart';


class NetworkMonitorScreen extends StatefulWidget {
  const NetworkMonitorScreen({super.key});

  @override
  State<NetworkMonitorScreen> createState() => _NetworkMonitorScreenState();
}

class _NetworkMonitorScreenState extends State<NetworkMonitorScreen> {
  final List<_ServiceHealth> _services = [
    _ServiceHealth('Loans', 'https://54link-dev.upi.dev/loan/health'),
    _ServiceHealth('LPO', 'https://54link-dev.upi.dev/lpo/health'),
    _ServiceHealth('Cards', 'https://54link-dev.upi.dev/card/health'),
    _ServiceHealth('Savings', 'https://54link-dev.upi.dev/savings/health'),
    _ServiceHealth('Disputes', 'https://54link-dev.upi.dev/dispute/health'),
    _ServiceHealth('Education Loan', 'https://54link-dev.upi.dev/education-loan/health'),
    _ServiceHealth('Payment Processing', 'https://54link-dev.upi.dev/payment-processing/health'),
    _ServiceHealth('Transactions ', 'https://54link-dev.upi.dev/ledger/health'),
    _ServiceHealth('Carbon Credit', 'https://54link-dev.upi.dev/carbon/health'),
  ];

  final Dio _dio = Dio();
  final Map<String, _HealthStatus> _statusMap = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _checkAllServices();
  }

  Future<void> _checkAllServices() async {
    setState(() => _loading = true);
    final results = <String, _HealthStatus>{};
    for (final service in _services) {
      try {
        final response = await _dio.get(service.url);
        if (response.statusCode == 200) {
          results[service.name] = _HealthStatus.operational;
        } else {
          results[service.name] = _HealthStatus.down;
        }
      } catch (_) {
        results[service.name] = _HealthStatus.down;
      }
    }
    setState(() {
      _statusMap.clear();
      _statusMap.addAll(results);
      _loading = false;
    });
  }

  Color _statusColor(_HealthStatus status) {
    switch (status) {
      case _HealthStatus.operational:
        return Colors.green;
      case _HealthStatus.down:
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _statusText(_HealthStatus status) {
    switch (status) {
      case _HealthStatus.operational:
        return 'Operational';
      case _HealthStatus.down:
        return 'Down';
      default:
        return 'Unknown';
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.bankNetworkMonitor),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _checkAllServices,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _services.length,
              itemBuilder: (context, index) {
                final service = _services[index];
                final status = _statusMap[service.name] ?? _HealthStatus.unknown;
                return Card(
                  child: ListTile(
                    leading: Icon(Icons.cloud_outlined, color: _statusColor(status)),
                    title: Text(service.name),
                    // subtitle: Text(service.url),
                    trailing: Text(
                      _statusText(status),
                      style: TextStyle(
                        color: _statusColor(status),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}

enum _HealthStatus { operational, down, unknown }

class _ServiceHealth {
  final String name;
  final String url;
  const _ServiceHealth(this.name, this.url);
}
