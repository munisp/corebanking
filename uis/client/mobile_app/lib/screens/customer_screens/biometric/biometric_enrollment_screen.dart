import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../config/app_theme.dart';
import '../../../providers/tenant_provider.dart';

class BiometricEnrollmentScreen extends StatefulWidget {
  const BiometricEnrollmentScreen({super.key});

  @override
  State<BiometricEnrollmentScreen> createState() => _BiometricEnrollmentScreenState();
}

class _BiometricEnrollmentScreenState extends State<BiometricEnrollmentScreen> {
  bool _fingerprintEnabled = false;
  bool _faceIdEnabled = false;
  bool _voiceEnabled = false;
  bool _loading = false;

  Future<void> _saveSettings() async {
    setState(() => _loading = true);
    await Future.delayed(const Duration(milliseconds: 800));
    if (mounted) {
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Biometric settings saved'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Biometric Authentication',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Theme.of(context).colorScheme.primary.withOpacity(0.1),
                    Theme.of(context).colorScheme.primary.withOpacity(0.04),
                  ],
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: Theme.of(context).colorScheme.primary.withOpacity(0.2),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(
                      Icons.fingerprint_rounded,
                      color: Theme.of(context).colorScheme.primary,
                      size: 32,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Secure Biometric Login',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.getTextPrimary(context),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Use your biometrics for faster, more secure authentication.',
                          style: TextStyle(
                            fontSize: 13,
                            color: AppTheme.getTextSecondary(context),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),
            Text(
              'Authentication Methods',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppTheme.getTextPrimary(context),
              ),
            ),
            const SizedBox(height: 16),
            _BiometricOptionTile(
              icon: Icons.fingerprint_rounded,
              title: 'Fingerprint',
              subtitle: 'Use your fingerprint to authenticate',
              value: _fingerprintEnabled,
              onChanged: (v) => setState(() => _fingerprintEnabled = v),
            ),
            const SizedBox(height: 12),
            _BiometricOptionTile(
              icon: Icons.face_rounded,
              title: 'Face ID',
              subtitle: 'Use facial recognition to authenticate',
              value: _faceIdEnabled,
              onChanged: (v) => setState(() => _faceIdEnabled = v),
            ),
            const SizedBox(height: 12),
            _BiometricOptionTile(
              icon: Icons.mic_rounded,
              title: 'Voice Recognition',
              subtitle: 'Use your voice as an authentication factor',
              value: _voiceEnabled,
              onChanged: (v) => setState(() => _voiceEnabled = v),
            ),
            const SizedBox(height: 32),
            // Security note
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.amber.withOpacity(0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.amber.withOpacity(0.3)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline_rounded, color: Colors.amber[700], size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Biometric data is stored securely on your device and never transmitted to our servers.',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppTheme.getTextSecondary(context),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),
            Consumer<TenantProvider>(
              builder: (context, tenantProvider, _) {
                return SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _saveSettings,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: tenantProvider.primaryColor,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      elevation: 0,
                    ),
                    child: _loading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text(
                            'Save Settings',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _BiometricOptionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _BiometricOptionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppTheme.getCardBackground(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: value
              ? Theme.of(context).colorScheme.primary.withOpacity(0.3)
              : Colors.transparent,
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: value
                  ? Theme.of(context).colorScheme.primary.withOpacity(0.12)
                  : Colors.grey.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              icon,
              color: value
                  ? Theme.of(context).colorScheme.primary
                  : Colors.grey,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.getTextPrimary(context),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppTheme.getTextSecondary(context),
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: Theme.of(context).colorScheme.primary,
          ),
        ],
      ),
    );
  }
}
