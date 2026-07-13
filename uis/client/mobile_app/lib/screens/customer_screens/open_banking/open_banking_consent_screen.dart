import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../config/app_theme.dart';
import '../../../providers/tenant_provider.dart';
import '../../../services/api_service.dart';

final _api = ApiService();

class OpenBankingConsentScreen extends StatefulWidget {
  const OpenBankingConsentScreen({super.key});

  @override
  State<OpenBankingConsentScreen> createState() => _OpenBankingConsentScreenState();
}

class _OpenBankingConsentScreenState extends State<OpenBankingConsentScreen> {
  List<Map<String, dynamic>> _consents = [];
  bool _loading = true;
  String? _error;
  String? _revoking;

  @override
  void initState() {
    super.initState();
    _loadConsents();
  }

  Future<void> _loadConsents() async {
    try {
      setState(() { _loading = true; _error = null; });
      final response = await _api.get('/open-banking/v1/consents');
      final data = response.data;
      final List<dynamic> items = data is List ? data : (data['items'] ?? []);
      setState(() => _consents = items.cast<Map<String, dynamic>>());
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _revokeConsent(String consentId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Revoke Access'),
        content: const Text('Revoke this data access consent? The third-party app will lose access immediately.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Revoke', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _revoking = consentId);
    try {
      await _api.delete('/open-banking/v1/consents/$consentId');
      setState(() => _consents.removeWhere((c) => c['id'] == consentId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to revoke consent. Please try again.'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _revoking = null);
    }
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '';
    try {
      final date = DateTime.parse(dateStr);
      return '${date.day} ${_month(date.month)} ${date.year}';
    } catch (_) {
      return dateStr;
    }
  }

  String _month(int m) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1];

  @override
  Widget build(BuildContext context) {
    final tenantProvider = Provider.of<TenantProvider>(context, listen: false);

    if (!tenantProvider.isFeatureEnabled('open_banking')) {
      return Scaffold(
        appBar: AppBar(title: const Text('Open Banking Consents')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.shield_outlined, size: 64, color: AppTheme.getTextSecondary(context)),
                const SizedBox(height: 16),
                Text('Open Banking Unavailable',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.getTextPrimary(context))),
                const SizedBox(height: 8),
                Text('Open Banking is not enabled for your account. Contact support to enable this feature.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.getTextSecondary(context))),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Open Banking Consents', style: TextStyle(fontWeight: FontWeight.bold)),
        elevation: 0,
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _loadConsents),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _loadConsents, child: const Text('Retry')),
                    ],
                  ),
                )
              : _buildBody(context, tenantProvider),
    );
  }

  Widget _buildBody(BuildContext context, TenantProvider tenantProvider) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Info banner
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.blue.withOpacity(0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.blue.withOpacity(0.25)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.shield_outlined, color: Colors.blue[700], size: 20),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Your data, your control', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      SizedBox(height: 4),
                      Text(
                        'You can revoke any third-party app\'s access to your data at any time. Revoking access is immediate and permanent.',
                        style: TextStyle(fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          if (_consents.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 60),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.shield_outlined, size: 64, color: AppTheme.getTextSecondary(context)),
                    const SizedBox(height: 16),
                    Text('No Active Consents',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.getTextPrimary(context))),
                    const SizedBox(height: 8),
                    Text("You haven't granted any third-party apps access to your account data yet.",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppTheme.getTextSecondary(context), fontSize: 13)),
                  ],
                ),
              ),
            )
          else
            ...(_consents.map((consent) => _ConsentCard(
              consent: consent,
              revoking: _revoking,
              onRevoke: _revokeConsent,
              formatDate: _formatDate,
              primaryColor: tenantProvider.primaryColor,
            ))),
        ],
      ),
    );
  }
}

class _ConsentCard extends StatelessWidget {
  final Map<String, dynamic> consent;
  final String? revoking;
  final void Function(String) onRevoke;
  final String Function(String?) formatDate;
  final Color primaryColor;

  const _ConsentCard({
    required this.consent,
    required this.revoking,
    required this.onRevoke,
    required this.formatDate,
    required this.primaryColor,
  });

  @override
  Widget build(BuildContext context) {
    final consentId = consent['id'] as String? ?? '';
    final tppName = consent['tppName'] as String? ?? 'Unknown App';
    final grantedAt = formatDate(consent['grantedAt'] as String?);
    final expiresAt = consent['expiresAt'] != null ? formatDate(consent['expiresAt'] as String?) : null;
    final isActive = consent['isActive'] as bool? ?? false;
    final dataAccess = (consent['dataAccess'] as List<dynamic>?)?.cast<String>() ?? [];
    final scopes = (consent['scopes'] as List<dynamic>?)?.cast<String>() ?? [];
    final displayScopes = dataAccess.isNotEmpty ? dataAccess : scopes;
    final isRevoking = revoking == consentId;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppTheme.getCardBackground(context),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: Colors.grey.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.open_in_new_rounded, color: Colors.grey, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(tppName, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.getTextPrimary(context))),
                      Text(
                        'Granted $grantedAt${expiresAt != null ? ' · Expires $expiresAt' : ''}',
                        style: TextStyle(fontSize: 11, color: AppTheme.getTextSecondary(context)),
                      ),
                    ],
                  ),
                ),
                Icon(
                  isActive ? Icons.toggle_on_rounded : Icons.toggle_off_rounded,
                  color: isActive ? Colors.green : Colors.grey,
                  size: 28,
                ),
              ],
            ),
            const SizedBox(height: 14),
            // Scopes
            if (displayScopes.isNotEmpty) ...[
              Text('DATA ACCESS',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: AppTheme.getTextSecondary(context))),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: displayScopes.map((s) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.grey.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(s.replaceAll('_', ' '), style: TextStyle(fontSize: 12, color: AppTheme.getTextSecondary(context))),
                )).toList(),
              ),
              const SizedBox(height: 14),
            ],
            // Revoke button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: isRevoking ? null : () => onRevoke(consentId),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.red,
                  side: const BorderSide(color: Colors.red, width: 1),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: isRevoking
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.red))
                    : const Icon(Icons.delete_outline_rounded, size: 16),
                label: Text(isRevoking ? 'Revoking...' : 'Revoke Access', style: const TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
